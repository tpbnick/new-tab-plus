import type { SpecialSectionMeta } from '../storage/schema';
import { loadSpecialSection, SECTION_TITLES, type SpecialSectionViewModel } from './index';

interface CacheEntry {
  vm: SpecialSectionViewModel;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

function cacheKey(meta: SpecialSectionMeta): string {
  return `${meta.id}:${meta.kind}:${meta.itemCount}`;
}

export function invalidateSpecialSectionCache(sectionIdOrKind?: string): void {
  if (!sectionIdOrKind) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${sectionIdOrKind}:`) || key.includes(`:${sectionIdOrKind}:`)) {
      cache.delete(key);
    }
  }
}

export async function loadSpecialSectionCached(
  meta: SpecialSectionMeta,
  options: { ttlMs?: number; bypassCache?: boolean } = {}
): Promise<SpecialSectionViewModel> {
  const bypassCache = options.bypassCache ?? false;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const key = cacheKey(meta);
  const now = Date.now();

  if (!bypassCache) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return hit.vm;
  }

  try {
    const vm = await loadSpecialSection(meta);
    if (!bypassCache) {
      cache.set(key, { vm, expiresAt: now + ttlMs });
    }
    return vm;
  } catch {
    return { id: meta.id, title: SECTION_TITLES[meta.kind], groups: [] };
  }
}
