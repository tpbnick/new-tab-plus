import { describe, expect, it, vi } from 'vitest';
import {
  getRecentlyClosed,
  resolveRecentlyClosedUrl,
  shouldSkipRecentlyClosedEntry,
  isHiddenRecentlyClosedUrl,
} from './recentlyClosed';

describe('isHiddenRecentlyClosedUrl', () => {
  it('hides this extension new-tab URLs but not other extension pages', () => {
    vi.stubGlobal('chrome', { runtime: { id: 'abc123' } });
    expect(isHiddenRecentlyClosedUrl('chrome-extension://abc123/src/newtab/index.html')).toBe(true);
    expect(isHiddenRecentlyClosedUrl('chrome-extension://otherext/page.html')).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('shouldSkipRecentlyClosedEntry', () => {
  it('skips browser new-tab URLs', () => {
    expect(shouldSkipRecentlyClosedEntry('New Tab', 'brave://newtab')).toBe(true);
    expect(shouldSkipRecentlyClosedEntry('New Tab', 'brave://newtab/')).toBe(true);
    expect(shouldSkipRecentlyClosedEntry('New Tab', 'chrome://newtab/')).toBe(true);
  });

  it('does not skip other extension pages', () => {
    expect(shouldSkipRecentlyClosedEntry('Other', 'chrome-extension://otherext/page.html')).toBe(false);
  });

  it('skips untitled entries with no URL from sessions API', () => {
    expect(shouldSkipRecentlyClosedEntry('Untitled', '')).toBe(true);
    expect(shouldSkipRecentlyClosedEntry('', undefined)).toBe(true);
  });

  it('keeps normal recently closed tabs', () => {
    expect(shouldSkipRecentlyClosedEntry('Example Site', 'https://example.com')).toBe(false);
    expect(shouldSkipRecentlyClosedEntry('GitHub', '')).toBe(false);
    expect(shouldSkipRecentlyClosedEntry('Untitled', 'https://example.com')).toBe(false);
  });
});

describe('resolveRecentlyClosedUrl', () => {
  it('falls back to pendingUrl when url is missing', () => {
    expect(
      resolveRecentlyClosedUrl({
        url: undefined,
        pendingUrl: 'https://example.com',
      } as chrome.sessions.Session['tab'])
    ).toBe('https://example.com');
  });
});

describe('getRecentlyClosed', () => {
  it('includes tabs restorable by sessionId when url and title are missing', async () => {
    vi.stubGlobal('chrome', {
      sessions: {
        getRecentlyClosed: vi.fn().mockResolvedValue([
          { tab: { sessionId: 'sess-1', url: undefined, title: undefined } },
        ]),
      },
    });

    await expect(getRecentlyClosed()).resolves.toEqual([
      { title: 'Closed tab', url: '', sessionId: 'sess-1' },
    ]);

    vi.unstubAllGlobals();
  });
});
