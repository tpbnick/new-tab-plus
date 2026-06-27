import { describe, expect, it } from 'vitest';
import { isAllowedNavigationUrl, safeNavigationUrl } from './externalLink';

describe('externalLink', () => {
  it('allows http and https URLs', () => {
    expect(isAllowedNavigationUrl('https://example.com')).toBe(true);
    expect(isAllowedNavigationUrl('http://example.com/path')).toBe(true);
  });

  it('allows chrome and extension URLs', () => {
    expect(isAllowedNavigationUrl('chrome://newtab')).toBe(true);
    expect(isAllowedNavigationUrl('chrome-extension://abc/page.html')).toBe(true);
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
});
