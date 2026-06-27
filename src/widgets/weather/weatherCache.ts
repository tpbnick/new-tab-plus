import type { ForecastResult } from './openMeteoClient';

interface WeatherCacheEntry {
  fetchedAt: number;
  ttlMs: number;
  data: ForecastResult;
}

const CACHE_KEY_PREFIX = 'weatherCache:';
const MAX_CACHE_ENTRIES = 12;
const DEFAULT_TTL_MS = 20 * 60 * 1000;

function cacheKey(locationKey: string): string {
  return CACHE_KEY_PREFIX + locationKey;
}

function normalizeTtlMs(ttlMs: number): number {
  return Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
}

export async function getCachedForecast(locationKey: string): Promise<ForecastResult | null> {
  const key = cacheKey(locationKey);
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as WeatherCacheEntry | undefined;
  if (!entry) return null;
  const ttlMs = normalizeTtlMs(entry.ttlMs);
  if (Date.now() - entry.fetchedAt > ttlMs) return null;
  return entry.data;
}

async function pruneWeatherCache(keepKey: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const entries = Object.entries(all)
    .filter(([key, value]) => key.startsWith(CACHE_KEY_PREFIX) && value && typeof value === 'object')
    .map(([key, value]) => {
      const entry = value as WeatherCacheEntry;
      return { key, fetchedAt: entry.fetchedAt ?? 0 };
    })
    .sort((a, b) => b.fetchedAt - a.fetchedAt);

  if (entries.length <= MAX_CACHE_ENTRIES) return;

  const remove: Record<string, null> = {};
  for (const entry of entries.slice(MAX_CACHE_ENTRIES)) {
    if (entry.key === keepKey) continue;
    remove[entry.key] = null;
  }
  if (Object.keys(remove).length > 0) {
    await chrome.storage.local.remove(Object.keys(remove));
  }
}

export async function setCachedForecast(locationKey: string, data: ForecastResult, ttlMs: number): Promise<void> {
  const key = cacheKey(locationKey);
  const entry: WeatherCacheEntry = { fetchedAt: Date.now(), ttlMs: normalizeTtlMs(ttlMs), data };
  await chrome.storage.local.set({ [key]: entry });
  await pruneWeatherCache(key);
}
