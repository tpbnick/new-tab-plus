import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '../about/appMeta.generated';
import { resetUpdateCheckStateForTests, runUpdateCheck } from './updateCheck';

vi.mock('../about/appMeta.generated', () => ({
  APP_VERSION: '1.0.2',
  GITHUB_REPO_URL: 'https://github.com/tpbnick/new-tab-plus',
}));

function makeLocalStorageMock() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (key: string) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }),
  };
}

describe('runUpdateCheck', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    resetUpdateCheckStateForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows a banner when a newer release is available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
        }),
      }))
    );

    await runUpdateCheck(
      {
        getCheckEnabled: () => true,
        getDismissedVersion: () => '',
        setDismissedVersion: async () => {},
      },
      { force: true }
    );

    expect(document.querySelector('.ntp-update-banner')?.textContent).toContain('v1.0.3');
  });

  it('hides the banner when checking is disabled', async () => {
    showExistingBanner();
    await runUpdateCheck({
      getCheckEnabled: () => false,
      getDismissedVersion: () => '',
      setDismissedVersion: async () => {},
    });
    expect(document.querySelector('.ntp-update-banner')).toBeNull();
  });

  it('does not show a banner for the current version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: `v${APP_VERSION}`,
          html_url: 'https://github.com/tpbnick/new-tab-plus/releases/latest',
        }),
      }))
    );

    await runUpdateCheck(
      {
        getCheckEnabled: () => true,
        getDismissedVersion: () => '',
        setDismissedVersion: async () => {},
      },
      { force: true }
    );

    expect(document.querySelector('.ntp-update-banner')).toBeNull();
  });

  it('respects a dismissed release version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
        }),
      }))
    );

    await runUpdateCheck(
      {
        getCheckEnabled: () => true,
        getDismissedVersion: () => '1.0.3',
        setDismissedVersion: async () => {},
      },
      { force: true }
    );

    expect(document.querySelector('.ntp-update-banner')).toBeNull();
  });

  it('does not cache failed API responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = {
      getCheckEnabled: () => true,
      getDismissedVersion: () => '',
      setDismissedVersion: async () => {},
    };

    await runUpdateCheck(ctx, { force: true });
    expect(document.querySelector('.ntp-update-banner')).toBeNull();

    await runUpdateCheck(ctx, { force: true });
    expect(document.querySelector('.ntp-update-banner')?.textContent).toContain('v1.0.3');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('re-runs with force after an in-flight check completes', async () => {
    let resolveFirstFetch: (() => void) | undefined;
    const fetchMock = vi.fn(async () => {
      if (!resolveFirstFetch) {
        await new Promise<void>((resolve) => {
          resolveFirstFetch = resolve;
        });
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = {
      getCheckEnabled: () => true,
      getDismissedVersion: () => '',
      setDismissedVersion: async () => {},
    };

    const first = runUpdateCheck(ctx);
    await Promise.resolve();
    const forced = runUpdateCheck(ctx, { force: true });
    resolveFirstFetch?.();
    await Promise.all([first, forced]);

    expect(document.querySelector('.ntp-update-banner')?.textContent).toContain('v1.0.3');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not show a banner if checking is disabled before the fetch completes', async () => {
    let resolveFetch: (() => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Promise((resolve) => {
            resolveFetch = () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  tag_name: 'v1.0.3',
                  html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
                }),
              });
          })
      )
    );

    let enabled = true;
    const check = runUpdateCheck({
      getCheckEnabled: () => enabled,
      getDismissedVersion: () => '',
      setDismissedVersion: async () => {},
    });

    await Promise.resolve();
    enabled = false;
    resolveFetch?.();
    await check;

    expect(document.querySelector('.ntp-update-banner')).toBeNull();
  });

  it('persists cache in chrome.storage.local across new tabs within 6h TTL', async () => {
    const localStorage = makeLocalStorageMock();
    vi.stubGlobal('chrome', { storage: { local: localStorage } });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v1.0.3',
        html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const ctx = {
      getCheckEnabled: () => true,
      getDismissedVersion: () => '',
      setDismissedVersion: async () => {},
    };

    await runUpdateCheck(ctx);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.data.updateCheckCache).toBeDefined();

    // Simulate opening a fresh tab (clears in-memory cache, keeps chrome.storage.local)
    resetUpdateCheckStateForTests();
    document.body.innerHTML = '<div id="app"></div>';

    await runUpdateCheck(ctx);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ntp-update-banner')?.textContent).toContain('v1.0.3');
  });

  it('backs off non-forced checks for 15 minutes after a failed API response', async () => {
    vi.useFakeTimers();
    const localStorage = makeLocalStorageMock();
    vi.stubGlobal('chrome', { storage: { local: localStorage } });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = {
      getCheckEnabled: () => true,
      getDismissedVersion: () => '',
      setDismissedVersion: async () => {},
    };

    await runUpdateCheck(ctx);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Within 15-minute backoff: non-forced check should skip fetch
    vi.advanceTimersByTime(5 * 60 * 1000);
    await runUpdateCheck(ctx);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After 15-minute backoff: retries and succeeds
    vi.advanceTimersByTime(11 * 60 * 1000);
    await runUpdateCheck(ctx);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.ntp-update-banner')?.textContent).toContain('v1.0.3');
  });

  it('does not recursively re-run when concurrent non-forced checks overlap', async () => {
    let resolveFetch: (() => void) | undefined;
    const fetchMock = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        resolveFetch = resolve;
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = {
      getCheckEnabled: () => true,
      getDismissedVersion: () => '',
      setDismissedVersion: async () => {},
    };

    const first = runUpdateCheck(ctx);
    await Promise.resolve();
    const second = runUpdateCheck(ctx);
    resolveFetch?.();
    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles rejected setDismissedVersion cleanly on banner dismiss', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
        }),
      }))
    );

    const setDismissedVersion = vi.fn(async () => {
      throw new Error('storage write failed');
    });

    await runUpdateCheck(
      {
        getCheckEnabled: () => true,
        getDismissedVersion: () => '',
        setDismissedVersion,
      },
      { force: true }
    );

    document.querySelector<HTMLButtonElement>('.ntp-update-banner__close')?.click();
    await Promise.resolve();
    expect(setDismissedVersion).toHaveBeenCalledWith('1.0.3');
  });
});

function showExistingBanner(): void {
  const banner = document.createElement('div');
  banner.className = 'ntp-update-banner';
  document.getElementById('app')?.appendChild(banner);
}
