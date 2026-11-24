import type { WidgetContext, WidgetDefinition, WidgetInstance, WidgetSettingsField } from '../contract';
import { fetchForecast, formatGeocodeName, resolveLocationFromQuery, type ForecastResult } from './openMeteoClient';
import { getCachedForecastEntry, setCachedForecast } from './weatherCache';
import { getWmoInfo } from './wmoCodes';
import type { WeatherIconName } from './weatherIcons';
import { createWeatherIcon } from './weatherIcons';

const PLACEHOLDER_TEMP = '88°';
const PLACEHOLDER_RANGE = 'L:88° H:88°';
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 1440;
const RETRY_DELAY_MS = 5 * 60 * 1000;

export interface WeatherSettings {
  [key: string]: unknown;
  locationQuery: string;
  locationName: string;
  /** The exact locationQuery string that produced the current lat/lon/locationName.
   *  Compared against locationQuery (not locationName, which is an expanded
   *  display string and can never equal the raw query) to decide whether a
   *  re-geocode is needed. */
  resolvedQuery: string;
  latitude: number | null;
  longitude: number | null;
  tempUnit: 'celsius' | 'fahrenheit';
  ttlMinutes: number;
}

const defaultSettings: WeatherSettings = {
  locationQuery: '',
  locationName: '',
  resolvedQuery: '',
  latitude: null,
  longitude: null,
  tempUnit: 'fahrenheit',
  ttlMinutes: 20,
};

const settingsSchema: WidgetSettingsField[] = [
  { key: 'locationQuery', label: 'Location (city, or city, state)', type: 'text', default: '' },
  {
    key: 'tempUnit',
    label: 'Temperature unit',
    type: 'select',
    options: [
      { value: 'celsius', label: 'Celsius' },
      { value: 'fahrenheit', label: 'Fahrenheit' },
    ],
    default: 'fahrenheit',
  },
  {
    key: 'ttlMinutes',
    label: 'Refresh interval (minutes)',
    type: 'number',
    min: MIN_TTL_MINUTES,
    max: MAX_TTL_MINUTES,
    default: 20,
  },
];

class WeatherWidgetInstance implements WidgetInstance {
  private destroyed = false;
  private refreshTimerId: number | undefined;
  private attemptedLocationClear = false;
  private failedGeocodeQuery: string | null = null;
  private abortController: AbortController | null = null;
  // Bumped on every render() call so a stale, still-in-flight call (e.g. one
  // racing against a newer render triggered by a settings change) can detect
  // it's no longer the latest and bail out without touching the DOM, making
  // redundant network calls, or recursing into saveSettings/refresh again.
  private renderGeneration = 0;

  constructor(
    private container: HTMLElement,
    private settings: WeatherSettings,
    private ctx: WidgetContext
  ) {
    if (this.settings.latitude != null && this.settings.longitude != null) {
      this.renderLoadingShell();
    }
  }

  async render(): Promise<void> {
    if (this.destroyed) return;
    const myGeneration = ++this.renderGeneration;
    window.clearTimeout(this.refreshTimerId);
    this.refreshTimerId = undefined;
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    const isStale = () => this.destroyed || myGeneration !== this.renderGeneration;

    if (!this.settings.locationQuery.trim()) {
      this.failedGeocodeQuery = null;
      const hasSavedPlace =
        this.settings.latitude != null ||
        this.settings.longitude != null ||
        this.settings.locationName !== '' ||
        this.settings.resolvedQuery !== '';
      if (hasSavedPlace && !this.attemptedLocationClear) {
        this.attemptedLocationClear = true;
        await this.ctx.saveSettings({
          locationQuery: '',
          latitude: null,
          longitude: null,
          locationName: '',
          resolvedQuery: '',
        });
        if (isStale()) return;
      }
      this.renderUnconfigured();
      return;
    }
    this.attemptedLocationClear = false;

    if (this.failedGeocodeQuery !== null && this.settings.locationQuery !== this.failedGeocodeQuery) {
      this.failedGeocodeQuery = null;
    }

    if (this.settings.locationQuery !== this.settings.resolvedQuery) {
      if (this.settings.locationQuery === this.failedGeocodeQuery) {
        this.container.innerHTML = '<p class="widget-error">Location lookup failed.</p>';
        return;
      }
      if (this.settings.latitude != null && this.settings.longitude != null) {
        this.renderLoadingShell();
      } else {
        this.container.innerHTML = '<p class="widget-loading">Finding location…</p>';
      }
      try {
        const best = await resolveLocationFromQuery(this.settings.locationQuery, controller.signal);
        if (isStale()) return;
        if (!best) {
          this.container.replaceChildren();
          const msg = document.createElement('p');
          msg.className = 'widget-error';
          msg.textContent = `No location found for "${this.settings.locationQuery}".`;
          this.container.appendChild(msg);
          return;
        }
        const resolvedName = formatGeocodeName(best);
        const queryBeingSaved = this.settings.locationQuery;
        // Mark before saveSettings so a rollback + recursive refresh() on save
        // failure cannot re-enter geocoding in an infinite loop.
        this.failedGeocodeQuery = queryBeingSaved;
        // saveSettings triggers its own refresh() -> render() with the resolved
        // coordinates, so this call must not also continue on to fetch weather
        // itself below - that would race the recursive render with this one.
        await this.ctx.saveSettings({
          latitude: best.latitude,
          longitude: best.longitude,
          locationName: resolvedName,
          resolvedQuery: queryBeingSaved,
        });
        if (!isStale() && this.settings.locationQuery !== this.settings.resolvedQuery) {
          this.container.innerHTML = '<p class="widget-error">Location lookup failed.</p>';
        }
        return;
      } catch {
        if (!isStale()) {
          this.container.innerHTML = '<p class="widget-error">Location lookup failed.</p>';
          this.scheduleRefresh(RETRY_DELAY_MS);
        }
        return;
      }
    }

    if (this.settings.latitude == null || this.settings.longitude == null) {
      this.renderUnconfigured();
      return;
    }

    this.renderLoadingShell();

    const ttlMs = this.ttlMinutes() * 60 * 1000;
    const locationKey = `${this.settings.latitude},${this.settings.longitude},${this.settings.tempUnit}`;
    let cached: Awaited<ReturnType<typeof getCachedForecastEntry>> = null;
    try {
      cached = await getCachedForecastEntry(locationKey, ttlMs);
    } catch (err) {
      console.warn('[new-tab-plus] failed to read weather cache', err);
      cached = null;
    }
    if (isStale()) return;

    let data: ForecastResult | null = cached ? cached.data : null;
    let nextRefreshMs = cached ? Math.min(cached.remainingMs, ttlMs) : ttlMs;

    if (!data) {
      try {
        data = await fetchForecast(
          this.settings.latitude,
          this.settings.longitude,
          this.settings.tempUnit,
          controller.signal
        );
      } catch {
        if (!isStale()) {
          this.container.innerHTML = '<p class="widget-error">Weather unavailable.</p>';
          this.scheduleRefresh(RETRY_DELAY_MS);
        }
        return;
      }
      if (isStale()) return;

      try {
        await setCachedForecast(locationKey, data, ttlMs);
      } catch (err) {
        console.warn('[new-tab-plus] failed to write weather cache', err);
      }
      if (isStale()) return;
      nextRefreshMs = ttlMs;
    }

    if (!isStale()) {
      this.renderData(data);
      this.scheduleRefresh(nextRefreshMs);
    }
  }

  private ttlMinutes(): number {
    const minutes = Number(this.settings.ttlMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return 20;
    return Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, minutes));
  }

  private scheduleRefresh(delayMs: number = this.ttlMinutes() * 60 * 1000): void {
    window.clearTimeout(this.refreshTimerId);
    const maxDelayMs = MAX_TTL_MINUTES * 60 * 1000;
    const clampedDelayMs = Number.isFinite(delayMs)
      ? Math.min(maxDelayMs, Math.max(1000, delayMs))
      : this.ttlMinutes() * 60 * 1000;
    this.refreshTimerId = window.setTimeout(() => {
      if (!this.destroyed) {
        void this.render();
      }
    }, clampedDelayMs);
  }

  private renderLoadingShell(): void {
    this.renderCompact({
      temp: PLACEHOLDER_TEMP,
      range: PLACEHOLDER_RANGE,
      icon: 'cloud',
      loading: true,
    });
  }

  private isTopBarWidget(): boolean {
    return this.ctx.variant === 'inline' || Boolean(this.container.closest('.widget-inline'));
  }

  private renderUnconfigured(): void {
    if (this.isTopBarWidget()) {
      this.renderCompact({
        temp: '--°',
        icon: 'cloud',
        title: 'Set a location in Settings → Widgets → Weather',
        unconfigured: true,
      });
      return;
    }

    this.container.replaceChildren();
    const msg = document.createElement('p');
    msg.className = 'widget-empty-state';
    msg.textContent = 'Set a location in widget settings.';
    this.container.appendChild(msg);
  }

  private renderCompact(options: {
    temp: string;
    range?: string;
    icon: WeatherIconName;
    loading?: boolean;
    unconfigured?: boolean;
    title?: string;
  }): void {
    this.container.replaceChildren();

    const wrap = document.createElement('div');
    const classes = ['weather-compact'];
    if (options.loading) classes.push('weather-compact--loading');
    if (options.unconfigured) classes.push('weather-compact--unconfigured');
    wrap.className = classes.join(' ');
    if (options.title) wrap.title = options.title;

    const currentRow = document.createElement('div');
    currentRow.className = 'weather-compact__current';

    const temp = document.createElement('span');
    temp.className = 'weather-compact__temp';
    temp.textContent = options.temp;
    currentRow.append(temp, createWeatherIcon(options.icon));

    wrap.appendChild(currentRow);

    if (options.range) {
      const range = document.createElement('span');
      range.className = 'weather-compact__range';
      range.textContent = options.range;
      wrap.appendChild(range);
    }

    this.container.appendChild(wrap);
  }

  private renderData(data: ForecastResult): void {
    const current = getWmoInfo(data.currentWeatherCode);
    const today = data.daily[0];
    const tempMin = today ? Math.round(today.tempMin) : null;
    const tempMax = today ? Math.round(today.tempMax) : null;

    this.renderCompact({
      temp: `${Math.round(data.currentTemperature)}°`,
      range:
        tempMin != null && tempMax != null ? `L:${tempMin}° H:${tempMax}°` : PLACEHOLDER_RANGE,
      icon: current.icon,
      title: this.settings.locationName
        ? `${this.settings.locationName} — ${current.label}`
        : current.label,
    });
  }

  async refresh(): Promise<void> {
    await this.render();
  }

  destroy(): void {
    this.destroyed = true;
    this.abortController?.abort();
    this.abortController = null;
    window.clearTimeout(this.refreshTimerId);
  }
}

export const weatherWidgetDefinition: WidgetDefinition<WeatherSettings> = {
  id: 'weather',
  displayName: 'Weather',
  description: 'Shows current conditions and a short forecast for a location you choose.',
  settingsSchema,
  defaultSettings,
  create(container, settings, ctx) {
    return new WeatherWidgetInstance(container, settings, ctx);
  },
};
