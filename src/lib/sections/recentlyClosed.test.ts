import { describe, expect, it } from 'vitest';
import {
  resolveRecentlyClosedUrl,
  shouldSkipRecentlyClosedEntry,
} from './recentlyClosed';

describe('shouldSkipRecentlyClosedEntry', () => {
  it('skips browser and extension new-tab URLs', () => {
    expect(
      shouldSkipRecentlyClosedEntry('Untitled', 'chrome-extension://abc123/index.html')
    ).toBe(true);
    expect(
      shouldSkipRecentlyClosedEntry('New Tab', 'brave://newtab')
    ).toBe(true);
    expect(
      shouldSkipRecentlyClosedEntry('New Tab', 'brave://newtab/')
    ).toBe(true);
    expect(shouldSkipRecentlyClosedEntry('New Tab', 'chrome://newtab/')).toBe(true);
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
