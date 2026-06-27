import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '../about/appMeta.generated';
import { runUpdateCheck } from './updateCheck';

vi.mock('../about/appMeta.generated', () => ({
  APP_VERSION: '1.0.2',
  GITHUB_REPO_URL: 'https://github.com/tpbnick/new-tab-plus',
}));

describe('runUpdateCheck', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.restoreAllMocks();
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
});

function showExistingBanner(): void {
  const banner = document.createElement('div');
  banner.className = 'ntp-update-banner';
  document.getElementById('app')?.appendChild(banner);
}
