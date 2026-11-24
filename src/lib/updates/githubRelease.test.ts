import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestGithubRelease } from './githubRelease';

describe('fetchLatestGithubRelease', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('returns null for null JSON payload or non-GitHub / non-https html_url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => null,
      }))
    );
    await expect(fetchLatestGithubRelease('https://github.com/tpbnick/new-tab-plus')).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'https://evil.example/releases/tag/v1.0.3',
        }),
      }))
    );
    await expect(fetchLatestGithubRelease('https://github.com/tpbnick/new-tab-plus')).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.3',
          html_url: 'http://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
        }),
      }))
    );
    await expect(fetchLatestGithubRelease('https://github.com/tpbnick/new-tab-plus')).resolves.toBeNull();
  });

  it('aborts and returns null when the fetch times out', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      )
    );

    const promise = fetchLatestGithubRelease('https://github.com/tpbnick/new-tab-plus');
    await vi.advanceTimersByTimeAsync(8000);
    await expect(promise).resolves.toBeNull();
  });
});
