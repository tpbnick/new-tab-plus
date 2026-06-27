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
      release: Awaited<ReturnType<typeof fetchLatestGithubRelease>>;
    }
  | null = null;

let checkInFlight: Promise<void> | null = null;

function shouldUseCache(): boolean {
  if (!cachedRelease) return false;
  return Date.now() - cachedRelease.fetchedAt < CHECK_CACHE_MS;
}

async function loadLatestRelease(force = false): Promise<Awaited<ReturnType<typeof fetchLatestGithubRelease>>> {
  if (!force && shouldUseCache()) {
    return cachedRelease!.release;
  }

  const release = await fetchLatestGithubRelease(GITHUB_REPO_URL);
  cachedRelease = { fetchedAt: Date.now(), release };
  return release;
}

export async function runUpdateCheck(ctx: UpdateCheckContext, opts: { force?: boolean } = {}): Promise<void> {
  if (!ctx.getCheckEnabled()) {
    hideUpdateBanner();
    return;
  }

  if (checkInFlight) {
    await checkInFlight;
    return;
  }

  checkInFlight = (async () => {
    try {
      const release = await loadLatestRelease(opts.force ?? false);
      if (!release) return;

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
