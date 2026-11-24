import type { ForecastResult } from './openMeteoClient';

interface WeatherCacheEntry {
  fetchedAt: number;
  ttlMs: number;
  data: ForecastResult;
}

const CACHE_KEY_PREFIX = 'weatherCache:';
const INDEX_KEY = 'weatherCacheKeys';
const MAX_CACHE_ENTRIES = 12;
const DEFAULT_TTL_MS = 20 * 60 * 1000;

function cacheKey(locationKey: string): string {
  return CACHE_KEY_PREFIX + locationKey;
}

function normalizeTtlMs(ttlMs: number): number {
  return Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
}

function isCacheKey(key: string): boolean {
  return key.startsWith(CACHE_KEY_PREFIX);
}

export interface CachedForecastEntry {
  data: ForecastResult;
  remainingMs: number;
}

export async function getCachedForecastEntry(
  locationKey: string,
  maxTtlMs?: number
): Promise<CachedForecastEntry | null> {
  const key = cacheKey(locationKey);
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as WeatherCacheEntry | undefined;
  if (!entry) return null;
  const storedTtlMs = normalizeTtlMs(entry.ttlMs);
  const effectiveTtlMs =
    maxTtlMs !== undefined ? Math.min(storedTtlMs, normalizeTtlMs(maxTtlMs)) : storedTtlMs;
  const elapsed = Date.now() - entry.fetchedAt;
  if (elapsed >= effectiveTtlMs) return null;
  const remainingMs = Math.min(effectiveTtlMs, Math.max(1, effectiveTtlMs - elapsed));
  return { data: entry.data, remainingMs };
}

async function readIndex(): Promise<string[] | null> {
  const result = await chrome.storage.local.get(INDEX_KEY);
  const keys = result[INDEX_KEY];
  if (!Array.isArray(keys)) return null;
  return keys.filter((key): key is string => typeof key === 'string' && isCacheKey(key));
}

async function migrateIndex(): Promise<string[]> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.entries(all)
    .filter(([key, value]) => isCacheKey(key) && value && typeof value === 'object')
    .map(([key, value]) => ({ key, fetchedAt: (value as WeatherCacheEntry).fetchedAt ?? 0 }))
    .sort((a, b) => b.fetchedAt - a.fetchedAt)
    .map((entry) => entry.key);
  await chrome.storage.local.set({ [INDEX_KEY]: keys });
  return keys;
}

async function getIndex(): Promise<string[]> {
  return (await readIndex()) ?? migrateIndex();
}

async function pruneWeatherCache(keepKey: string): Promise<void> {
  const keys = await getIndex();
  const next = [keepKey, ...keys.filter((key) => key !== keepKey)];
  const keep = next.slice(0, MAX_CACHE_ENTRIES);
  const remove = next.slice(MAX_CACHE_ENTRIES);
  if (remove.length > 0) {
    await chrome.storage.local.remove(remove);
  }
  await chrome.storage.local.set({ [INDEX_KEY]: keep });
}

export async function setCachedForecast(locationKey: string, data: ForecastResult, ttlMs: number): Promise<void> {
  const key = cacheKey(locationKey);
  const entry: WeatherCacheEntry = { fetchedAt: Date.now(), ttlMs: normalizeTtlMs(ttlMs), data };
  await chrome.storage.local.set({ [key]: entry });
  await pruneWeatherCache(key);
}
