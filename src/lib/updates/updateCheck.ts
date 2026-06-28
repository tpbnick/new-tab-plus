import { APP_VERSION, GITHUB_REPO_URL } from '../about/appMeta.generated';
import { hideUpdateBanner, showUpdateBanner } from '../ui/updateBanner';
import { isVersionNewer } from './compareVersions';
import { fetchLatestGithubRelease } from './githubRelease';

export { hideUpdateBanner } from '../ui/updateBanner';

const CHECK_CACHE_MS = 6 * 60 * 60 * 1000;

export interface UpdateCheckContext {
  getCheckEnabled: () => boolean;
  getDismissedVersion: () => string;
  setDismissedVersion: (version: string) => Promise<void>;
}

let cachedRelease:
  | {
      fetchedAt: number;
      release: NonNullable<Awaited<ReturnType<typeof fetchLatestGithubRelease>>>;
    }
  | null = null;

let checkInFlight: Promise<void> | null = null;
let queuedForce = false;

function shouldUseCache(): boolean {
  if (!cachedRelease) return false;
  return Date.now() - cachedRelease.fetchedAt < CHECK_CACHE_MS;
}

async function loadLatestRelease(
  force = false
): Promise<Awaited<ReturnType<typeof fetchLatestGithubRelease>>> {
  if (!force && shouldUseCache()) {
    return cachedRelease!.release;
  }

  const release = await fetchLatestGithubRelease(GITHUB_REPO_URL);
  if (release) {
    cachedRelease = { fetchedAt: Date.now(), release };
  }
  return release;
}

function applyUpdateCheckResult(
  ctx: UpdateCheckContext,
  release: NonNullable<Awaited<ReturnType<typeof fetchLatestGithubRelease>>>
): void {
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
      void ctx.setDismissedVersion(release.version);
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
    const force = queuedForce;
    queuedForce = false;
    return runUpdateCheck(ctx, force ? { force: true } : {});
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
  cachedRelease = null;
  checkInFlight = null;
  queuedForce = false;
}
