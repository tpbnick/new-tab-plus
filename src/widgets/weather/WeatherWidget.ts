import type { WidgetContext, WidgetDefinition, WidgetInstance, WidgetSettingsField } from '../contract';
import { fetchForecast, formatGeocodeName, resolveLocationFromQuery, type ForecastResult } from './openMeteoClient';
import { getCachedForecast, setCachedForecast } from './weatherCache';
import { getWmoInfo } from './wmoCodes';
import type { WeatherIconName } from './weatherIcons';
import { createWeatherIcon } from './weatherIcons';

const PLACEHOLDER_TEMP = '88°';
const PLACEHOLDER_RANGE = 'L:88° H:88°';

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
  tempUnit: 'celsius',
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
    default: 'celsius',
  },
  { key: 'ttlMinutes', label: 'Refresh interval (minutes)', type: 'number', default: 20 },
];

class WeatherWidgetInstance implements WidgetInstance {
  private destroyed = false;
  private refreshTimerId: number | undefined;
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
    const myGeneration = ++this.renderGeneration;
    window.clearTimeout(this.refreshTimerId);
    this.refreshTimerId = undefined;
    const isStale = () => this.destroyed || myGeneration !== this.renderGeneration;

    if (isStale()) return;

    if (this.settings.locationQuery && this.settings.locationQuery !== this.settings.resolvedQuery) {
      if (this.settings.latitude != null && this.settings.longitude != null) {
        this.renderLoadingShell();
      } else {
        this.container.innerHTML = '<p class="widget-loading">Finding location…</p>';
      }
      try {
        const best = await resolveLocationFromQuery(this.settings.locationQuery);
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
        // saveSettings triggers its own refresh() -> render() with the resolved
        // coordinates, so this call must not also continue on to fetch weather
        // itself below - that would race the recursive render with this one.
        await this.ctx.saveSettings({
          latitude: best.latitude,
          longitude: best.longitude,
          locationName: resolvedName,
          resolvedQuery: this.settings.locationQuery,
        });
        return;
      } catch {
        if (!isStale()) {
          this.container.innerHTML = '<p class="widget-error">Location lookup failed.</p>';
        }
        return;
      }
    }

    if (this.settings.latitude == null || this.settings.longitude == null) {
      this.container.innerHTML = '<p class="widget-empty-state">Set a location in widget settings (⚙) to show weather.</p>';
      return;
    }

    this.renderLoadingShell();

    const locationKey = `${this.settings.latitude},${this.settings.longitude},${this.settings.tempUnit}`;
    let data = await getCachedForecast(locationKey);
    if (isStale()) return;

    if (!data) {
      try {
        data = await fetchForecast(this.settings.latitude, this.settings.longitude, this.settings.tempUnit);
        if (isStale()) return;
        await setCachedForecast(
          locationKey,
          data,
          this.ttlMinutes() * 60 * 1000
        );
      } catch {
        if (!isStale()) {
          this.container.innerHTML = '<p class="widget-error">Weather unavailable.</p>';
        }
        return;
      }
    }

    if (!isStale()) {
      this.renderData(data);
      this.scheduleRefresh();
    }
  }

  private ttlMinutes(): number {
    const minutes = Number(this.settings.ttlMinutes);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 20;
  }

  private scheduleRefresh(): void {
    window.clearTimeout(this.refreshTimerId);
    const ttlMs = this.ttlMinutes() * 60 * 1000;
    this.refreshTimerId = window.setTimeout(() => {
      if (!this.destroyed) {
        void this.render();
      }
    }, ttlMs);
  }

  private renderLoadingShell(): void {
    this.renderCompact({
      temp: PLACEHOLDER_TEMP,
      range: PLACEHOLDER_RANGE,
      icon: 'cloud',
      loading: true,
    });
  }

  private renderCompact(options: {
    temp: string;
    range: string;
    icon: WeatherIconName;
    loading?: boolean;
    title?: string;
  }): void {
    this.container.replaceChildren();

    const wrap = document.createElement('div');
    wrap.className = options.loading ? 'weather-compact weather-compact--loading' : 'weather-compact';
    if (options.title) wrap.title = options.title;

    const currentRow = document.createElement('div');
    currentRow.className = 'weather-compact__current';

    const temp = document.createElement('span');
    temp.className = 'weather-compact__temp';
    temp.textContent = options.temp;
    currentRow.append(temp, createWeatherIcon(options.icon));

    wrap.appendChild(currentRow);

    const range = document.createElement('span');
    range.className = 'weather-compact__range';
    range.textContent = options.range;
    wrap.appendChild(range);

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
