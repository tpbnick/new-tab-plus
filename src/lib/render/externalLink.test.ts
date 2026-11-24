import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isAllowedNavigationUrl,
  isBrowserInternalUrl,
  navigateExternalUrl,
  safeNavigationUrl,
} from './externalLink';

describe('externalLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('allows http and https URLs', () => {
    expect(isAllowedNavigationUrl('https://example.com')).toBe(true);
    expect(isAllowedNavigationUrl('http://example.com/path')).toBe(true);
  });

  it('allows chrome and extension URLs', () => {
    expect(isAllowedNavigationUrl('chrome://newtab')).toBe(true);
    expect(isAllowedNavigationUrl('chrome-extension://abc/page.html')).toBe(true);
  });

  it('identifies browser-internal chrome:// URLs', () => {
    expect(isBrowserInternalUrl('chrome://apps/')).toBe(true);
    expect(isBrowserInternalUrl('chrome://settings')).toBe(true);
    expect(isBrowserInternalUrl('https://example.com')).toBe(false);
    expect(isBrowserInternalUrl('chrome-extension://abc/page.html')).toBe(false);
    expect(isBrowserInternalUrl('not a url')).toBe(false);
  });

  it('blocks javascript and data URLs', () => {
    expect(isAllowedNavigationUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedNavigationUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('blocks empty and malformed URLs', () => {
    expect(safeNavigationUrl('')).toBeNull();
    expect(safeNavigationUrl('   ')).toBeNull();
    expect(safeNavigationUrl('not a url')).toBeNull();
  });

  it('returns trimmed safe URLs', () => {
    expect(safeNavigationUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('navigates chrome:// URLs via chrome.tabs.update or chrome.tabs.create', () => {
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    vi.stubGlobal('chrome', { tabs: { update, create } });

    navigateExternalUrl('chrome://apps/', true);
    expect(update).toHaveBeenCalledWith({ url: 'chrome://apps/' });
    expect(create).not.toHaveBeenCalled();

    navigateExternalUrl('chrome://apps/', false);
    expect(create).toHaveBeenCalledWith({ url: 'chrome://apps/' });
  });

  it('catches rejected chrome.tabs promises safely', async () => {
    const update = vi.fn().mockRejectedValue(new Error('No current tab'));
    const create = vi.fn().mockRejectedValue(new Error('Tab failed'));
    vi.stubGlobal('chrome', { tabs: { update, create } });

    expect(() => navigateExternalUrl('chrome://apps/', true)).not.toThrow();
    expect(() => navigateExternalUrl('chrome://apps/', false)).not.toThrow();
    await Promise.resolve();
    expect(update).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
  });

  it('falls back to window.open for chrome:// URLs when chrome.tabs is unavailable', () => {
    vi.stubGlobal('chrome', undefined);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    navigateExternalUrl('chrome://apps/', false);
    expect(openSpy).toHaveBeenCalledWith('chrome://apps/', '_blank', 'noopener,noreferrer');
  });
});
