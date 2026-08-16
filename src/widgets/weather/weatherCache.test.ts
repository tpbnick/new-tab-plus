import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastResult } from './openMeteoClient';
import { getCachedForecast, setCachedForecast } from './weatherCache';

function makeLocalStorage() {
  const data: Record<string, unknown> = {};
  return {
    async get(key: string | string[] | null) {
      if (key === null) return { ...data };
      if (Array.isArray(key)) {
        const out: Record<string, unknown> = {};
        for (const k of key) {
          if (k in data) out[k] = data[k];
        }
        return out;
      }
      return key in data ? { [key]: data[key] } : {};
    },
    async set(items: Record<string, unknown>) {
      Object.assign(data, items);
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
    },
    _data: data,
  };
}

const forecast: ForecastResult = {
  currentTemperature: 72,
  currentWeatherCode: 0,
  daily: [],
};

describe('weatherCache', () => {
  let local: ReturnType<typeof makeLocalStorage>;

  beforeEach(() => {
    local = makeLocalStorage();
    vi.stubGlobal('chrome', { storage: { local } });
  });

  it('round-trips a forecast and keeps an index instead of scanning all keys', async () => {
    await setCachedForecast('seattle', forecast, 60_000);
    expect(await getCachedForecast('seattle')).toEqual(forecast);
    expect(local._data.weatherCacheKeys).toEqual(['weatherCache:seattle']);
  });

  it('migrates existing cache keys into the index on first write', async () => {
    local._data['weatherCache:old'] = {
      fetchedAt: Date.now(),
      ttlMs: 60_000,
      data: forecast,
    };
    await setCachedForecast('new', forecast, 60_000);
    expect(local._data.weatherCacheKeys).toEqual(['weatherCache:new', 'weatherCache:old']);
  });

  it('prunes oldest index entries after the cap', async () => {
    for (let i = 0; i < 13; i++) {
      await setCachedForecast(`loc-${i}`, forecast, 60_000);
    }
    const keys = local._data.weatherCacheKeys as string[];
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe('weatherCache:loc-12');
    expect(local._data['weatherCache:loc-0']).toBeUndefined();
  });
});
