import { APP_VERSION, GITHUB_REPO_URL } from '../about/appMeta.generated';
import { hideUpdateBanner, showUpdateBanner } from '../ui/updateBanner';
import { isVersionNewer } from './compareVersions';
import { fetchLatestGithubRelease, type GithubRelease } from './githubRelease';

export { hideUpdateBanner } from '../ui/updateBanner';

const CHECK_CACHE_MS = 6 * 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 15 * 60 * 1000;
const UPDATE_CHECK_CACHE_KEY = 'updateCheckCache';

export interface UpdateCheckContext {
  getCheckEnabled: () => boolean;
  getDismissedVersion: () => string;
  setDismissedVersion: (version: string) => Promise<void>;
}

interface UpdateCheckCacheEntry {
  fetchedAt: number;
  release: GithubRelease | null;
  failed: boolean;
}

let cachedEntry: UpdateCheckCacheEntry | null = null;
let checkInFlight: Promise<void> | null = null;
let queuedForce = false;

function getLocalStorage(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' &&
    chrome?.storage?.local &&
    typeof chrome.storage.local.get === 'function' &&
    typeof chrome.storage.local.set === 'function'
    ? chrome.storage.local
    : null;
}

function parseCacheEntry(raw: unknown): UpdateCheckCacheEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.fetchedAt !== 'number' || !Number.isFinite(obj.fetchedAt)) return null;
  if (typeof obj.failed !== 'boolean') return null;

  let release: GithubRelease | null = null;
  if (obj.release !== null && obj.release !== undefined) {
    if (
      typeof obj.release !== 'object' ||
      Array.isArray(obj.release) ||
      typeof (obj.release as Record<string, unknown>).version !== 'string' ||
      typeof (obj.release as Record<string, unknown>).url !== 'string'
    ) {
      return null;
    }
    release = {
      version: (obj.release as { version: string }).version,
      url: (obj.release as { url: string }).url,
    };
  }

  return { fetchedAt: obj.fetchedAt, release, failed: obj.failed };
}

async function readCachedEntryFromStorage(
  storage: chrome.storage.StorageArea
): Promise<UpdateCheckCacheEntry | null> {
  try {
    const result = await storage.get(UPDATE_CHECK_CACHE_KEY);
    const parsed = parseCacheEntry(result?.[UPDATE_CHECK_CACHE_KEY]);
    if (parsed) {
      if (!cachedEntry || parsed.fetchedAt >= cachedEntry.fetchedAt) {
        cachedEntry = parsed;
      }
      return cachedEntry;
    }
  } catch {
    /* fall back to in-memory cache */
  }
  return cachedEntry;
}

async function writeCachedEntry(entry: UpdateCheckCacheEntry): Promise<void> {
  cachedEntry = entry;
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    await storage.set({ [UPDATE_CHECK_CACHE_KEY]: entry });
  } catch {
    /* keep in-memory cache */
  }
}

function isCacheValid(entry: UpdateCheckCacheEntry | null): entry is UpdateCheckCacheEntry {
  if (!entry) return false;
  const age = Date.now() - entry.fetchedAt;
  if (age < 0) return false;
  const ttl = entry.failed ? FAILURE_BACKOFF_MS : CHECK_CACHE_MS;
  return age < ttl;
}

async function loadLatestRelease(force = false): Promise<GithubRelease | null> {
  if (!force) {
    const storage = getLocalStorage();
    const entry = storage ? await readCachedEntryFromStorage(storage) : cachedEntry;
    if (isCacheValid(entry)) {
      return entry.failed ? null : entry.release;
    }
  }

  const release = await fetchLatestGithubRelease(GITHUB_REPO_URL);
  if (release) {
    await writeCachedEntry({ fetchedAt: Date.now(), release, failed: false });
    return release;
  }

  await writeCachedEntry({ fetchedAt: Date.now(), release: null, failed: true });
  return null;
}

function applyUpdateCheckResult(ctx: UpdateCheckContext, release: GithubRelease): void {
  if (!ctx.getCheckEnabled()) {
    hideUpdateBanner();
    return;
  }

  if (!isVersionNewer(release.version, APP_VERSION)) {
    hideUpdateBanner();
    return;
  }

  if (ctx.getDismissedVersion() === release.version) {
    hideUpdateBanner();
    return;
  }

  showUpdateBanner({
    releaseUrl: release.url,
    latestVersion: release.version,
    onDismiss: () => {
      void ctx.setDismissedVersion(release.version).catch(() => {});
    },
  });
}

async function performUpdateCheck(ctx: UpdateCheckContext, force: boolean): Promise<void> {
  const release = await loadLatestRelease(force);
  if (!release) return;

  applyUpdateCheckResult(ctx, release);
}

export async function runUpdateCheck(ctx: UpdateCheckContext, opts: { force?: boolean } = {}): Promise<void> {
  if (!ctx.getCheckEnabled()) {
    hideUpdateBanner();
    return;
  }

  if (checkInFlight) {
    if (opts.force) queuedForce = true;
    await checkInFlight;
    if (!queuedForce) {
      if (checkInFlight) await checkInFlight;
      return;
    }
    queuedForce = false;
    return runUpdateCheck(ctx, { force: true });
  }

  checkInFlight = (async () => {
    try {
      await performUpdateCheck(ctx, opts.force ?? false);
    } catch {
      /* ignore network/API failures */
    } finally {
      checkInFlight = null;
    }
  })();

  await checkInFlight;
}

export function initUpdateChecker(ctx: UpdateCheckContext): () => void {
  const onVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') return;
    void runUpdateCheck(ctx);
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => document.removeEventListener('visibilitychange', onVisibilityChange);
}

/** Resets module-level cache/concurrency state (for unit tests). */
export function resetUpdateCheckStateForTests(): void {
  cachedEntry = null;
  checkInFlight = null;
  queuedForce = false;
}
