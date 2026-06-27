import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestGithubRelease } from './githubRelease';

describe('fetchLatestGithubRelease', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized version and release url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ tag_name: 'v1.0.3', html_url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3' }),
      }))
    );

    const release = await fetchLatestGithubRelease('https://github.com/tpbnick/new-tab-plus');
    expect(release).toEqual({
      version: '1.0.3',
      url: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
    });
  });

  it('returns null when no releases exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
      }))
    );

    await expect(fetchLatestGithubRelease('https://github.com/tpbnick/new-tab-plus')).resolves.toBeNull();
  });
});
