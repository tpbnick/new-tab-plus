import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { weatherWidgetDefinition, type WeatherSettings } from './WeatherWidget';

function makeLocalStorage(overrides: Partial<{ get: unknown; set: unknown; remove: unknown }> = {}) {
  const data: Record<string, unknown> = {};
  return {
    get:
      (overrides.get as (key: string | string[] | null) => Promise<Record<string, unknown>>) ??
      (async (key: string | string[] | null) => {
        if (key === null) return { ...data };
        if (Array.isArray(key)) {
          const out: Record<string, unknown> = {};
          for (const k of key) {
            if (k in data) out[k] = data[k];
          }
          return out;
        }
        return key in data ? { [key]: data[key] } : {};
      }),
    set:
      (overrides.set as (items: Record<string, unknown>) => Promise<void>) ??
      (async (items: Record<string, unknown>) => {
        Object.assign(data, items);
      }),
    remove:
      (overrides.remove as (keys: string | string[]) => Promise<void>) ??
      (async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete data[key];
        }
      }),
    _data: data,
  };
}

function makeSettings(overrides: Partial<WeatherSettings> = {}): WeatherSettings {
  return {
    locationQuery: '',
    locationName: '',
    resolvedQuery: '',
    latitude: null,
    longitude: null,
    tempUnit: 'fahrenheit',
    ttlMinutes: 20,
    ...overrides,
  };
}

const sampleForecastResponse = {
  current: { temperature_2m: 68, weather_code: 0 },
  daily: {
    time: ['2026-06-01'],
    temperature_2m_max: [74],
    temperature_2m_min: [55],
    weather_code: [0],
  },
};

describe('WeatherWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('chrome', { storage: { local: makeLocalStorage() } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears stored coordinates when the location field is emptied', async () => {
    const settings = makeSettings({
      locationQuery: '',
      locationName: 'Seattle',
      resolvedQuery: 'Seattle',
      latitude: 47.6,
      longitude: -122.3,
    });
    const saveSettings = vi.fn(async (partial: Record<string, unknown>) => {
      Object.assign(settings, partial);
    });
    const container = document.createElement('div');
    const instance = weatherWidgetDefinition.create(container, settings, {
      instanceId: 'weather',
      getSetting: <T>(key: string) => settings[key as keyof WeatherSettings] as T,
      saveSettings,
    });

    await instance.render();

    expect(saveSettings).toHaveBeenCalledWith({
      locationQuery: '',
      latitude: null,
      longitude: null,
      locationName: '',
      resolvedQuery: '',
    });
    expect(container.textContent).toContain('Set a location');
    instance.destroy();
  });

  it('renders compact unconfigured placeholder for inline variant before mounting into .top-bar', async () => {
    const settings = makeSettings();
    const container = document.createElement('div');
    const instance = weatherWidgetDefinition.create(container, settings, {
      instanceId: 'weather',
      variant: 'inline',
      getSetting: <T>(key: string) => settings[key as keyof WeatherSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });

    await instance.render();

    expect(container.querySelector('.weather-compact--unconfigured')).not.toBeNull();
    expect(container.querySelector('.weather-compact__temp')?.textContent).toBe('--°');
    instance.destroy();
  });

  it('does not loop infinitely when saving geocoded location fails and rolls back', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          { id: 1, name: 'Seattle', latitude: 47.6, longitude: -122.3, country: 'United States', admin1: 'Washington' },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const settings = makeSettings({ locationQuery: 'Seattle' });
    const container = document.createElement('div');
    let instanceRef: ReturnType<typeof weatherWidgetDefinition.create> | null = null;
    const saveSettings = vi.fn(async () => {
      // Simulate widgetColumnRenderer rollback + refresh on save failure
      await instanceRef?.refresh?.();
    });

    const instance = weatherWidgetDefinition.create(container, settings, {
      instanceId: 'weather',
      getSetting: <T>(key: string) => settings[key as keyof WeatherSettings] as T,
      saveSettings,
    });
    instanceRef = instance;

    await instance.render();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.widget-error')).not.toBeNull();

    // Changing the query allows geocoding again
    settings.locationQuery = 'Portland';
    await instance.render();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    instance.destroy();
  });

  it('clamps ttlMinutes to [5, 1440] and declares schema min/max', async () => {
    const ttlField = weatherWidgetDefinition.settingsSchema.find((f) => f.key === 'ttlMinutes');
    expect(ttlField?.min).toBe(5);
    expect(ttlField?.max).toBe(1440);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => sampleForecastResponse,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // Too small -> clamped to 5 minutes
    const smallSettings = makeSettings({
      locationQuery: 'Seattle',
      resolvedQuery: 'Seattle',
      locationName: 'Seattle',
      latitude: 47.6,
      longitude: -122.3,
      ttlMinutes: 0.01,
    });
    const inst1 = weatherWidgetDefinition.create(document.createElement('div'), smallSettings, {
      instanceId: 'w1',
      getSetting: <T>(key: string) => smallSettings[key as keyof WeatherSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });
    await inst1.render();
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 5 * 60 * 1000);
    inst1.destroy();

    // Too large -> clamped to 1440 minutes
    vi.stubGlobal('chrome', { storage: { local: makeLocalStorage() } });
    const hugeSettings = makeSettings({
      locationQuery: 'Seattle',
      resolvedQuery: 'Seattle',
      locationName: 'Seattle',
      latitude: 47.6,
      longitude: -122.3,
      ttlMinutes: 999_999,
    });
    const inst2 = weatherWidgetDefinition.create(document.createElement('div'), hugeSettings, {
      instanceId: 'w2',
      getSetting: <T>(key: string) => hugeSettings[key as keyof WeatherSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });
    await inst2.render();
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 1440 * 60 * 1000);
    inst2.destroy();
  });

  it('survives cache read/write errors without discarding freshly fetched weather data', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('chrome', {
      storage: {
        local: makeLocalStorage({
          get: async () => {
            throw new Error('storage read failed');
          },
          set: async () => {
            throw new Error('QUOTA_BYTES exceeded');
          },
        }),
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => sampleForecastResponse,
      }))
    );

    const settings = makeSettings({
      locationQuery: 'Seattle',
      resolvedQuery: 'Seattle',
      locationName: 'Seattle',
      latitude: 47.6,
      longitude: -122.3,
    });
    const container = document.createElement('div');
    const instance = weatherWidgetDefinition.create(container, settings, {
      instanceId: 'w',
      getSetting: <T>(key: string) => settings[key as keyof WeatherSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });

    await instance.render();

    expect(container.querySelector('.weather-compact__temp')?.textContent).toBe('68°');
    expect(container.querySelector('.widget-error')).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(2);
    instance.destroy();
  });

  it('schedules retry on transient forecast failure and recovers automatically', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sampleForecastResponse,
      });
    vi.stubGlobal('fetch', fetchMock);

    const settings = makeSettings({
      locationQuery: 'Seattle',
      resolvedQuery: 'Seattle',
      locationName: 'Seattle',
      latitude: 47.6,
      longitude: -122.3,
    });
    const container = document.createElement('div');
    const instance = weatherWidgetDefinition.create(container, settings, {
      instanceId: 'w',
      getSetting: <T>(key: string) => settings[key as keyof WeatherSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });

    await instance.render();
    expect(container.textContent).toContain('Weather unavailable.');

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(container.querySelector('.weather-compact__temp')?.textContent).toBe('68°');
    instance.destroy();
  });

  it('schedules refresh for cached forecast using remainingMs instead of full ttl', async () => {
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);
    const local = makeLocalStorage();
    local._data['weatherCache:47.6,-122.3,fahrenheit'] = {
      fetchedAt: now - 15 * 60 * 1000,
      ttlMs: 20 * 60 * 1000,
      data: {
        currentTemperature: 70,
        currentWeatherCode: 0,
        daily: [{ date: '2026-06-01', tempMin: 55, tempMax: 74, weatherCode: 0 }],
      },
    };
    vi.stubGlobal('chrome', { storage: { local } });
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    const settings = makeSettings({
      locationQuery: 'Seattle',
      resolvedQuery: 'Seattle',
      locationName: 'Seattle',
      latitude: 47.6,
      longitude: -122.3,
      ttlMinutes: 20,
    });
    const container = document.createElement('div');
    const instance = weatherWidgetDefinition.create(container, settings, {
      instanceId: 'w',
      getSetting: <T>(key: string) => settings[key as keyof WeatherSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });

    await instance.render();
    expect(container.querySelector('.weather-compact__temp')?.textContent).toBe('70°');
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 5 * 60 * 1000);
    instance.destroy();
  });

  it('aborts in-flight fetch signal on re-render and destroy', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise(() => {});
      })
    );

    const settings = makeSettings({
      locationQuery: 'Seattle',
      resolvedQuery: 'Seattle',
      locationName: 'Seattle',
      latitude: 47.6,
      longitude: -122.3,
    });
    const instance = weatherWidgetDefinition.create(document.createElement('div'), settings, {
      instanceId: 'w',
      getSetting: <T>(key: string) => settings[key as keyof WeatherSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });

    void instance.render();
    await vi.advanceTimersByTimeAsync(0);
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    void instance.render();
    await vi.advanceTimersByTimeAsync(0);
    expect(signals[0].aborted).toBe(true);
    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);

    instance.destroy();
    expect(signals[1].aborted).toBe(true);
  });
});
