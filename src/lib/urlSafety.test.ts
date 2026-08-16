import { describe, expect, it } from 'vitest';
import {
  isAllowedNavigationUrl,
  isSafeBackgroundUrl,
  validateBackgroundImageUrl,
} from './urlSafety';

describe('urlSafety', () => {
  it('allows navigation protocols', () => {
    expect(isAllowedNavigationUrl('https://example.com')).toBe(true);
    expect(isAllowedNavigationUrl('chrome://newtab')).toBe(true);
    expect(isAllowedNavigationUrl('chrome-extension://abc/page.html')).toBe(true);
  });

  it('blocks unsafe navigation protocols', () => {
    expect(isAllowedNavigationUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedNavigationUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('allows background image protocols', () => {
    expect(isSafeBackgroundUrl('https://example.com/bg.jpg')).toBe(true);
    expect(isSafeBackgroundUrl('data:image/png;base64,abc')).toBe(true);
  });

  it('rejects non-raster data image URLs', () => {
    expect(isSafeBackgroundUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isSafeBackgroundUrl('data:text/html,<h1>nope</h1>')).toBe(false);
    expect(validateBackgroundImageUrl('data:image/svg+xml,<svg></svg>').ok).toBe(false);
  });

  it('blocks chrome URLs for backgrounds', () => {
    expect(isSafeBackgroundUrl('chrome://theme/IDR_THEME_NTP_BACKGROUND')).toBe(false);
  });

  it('validates background image URL field input', () => {
    expect(validateBackgroundImageUrl('')).toEqual({ ok: true });
    expect(validateBackgroundImageUrl('https://example.com/a.jpg')).toEqual({ ok: true });
    expect(validateBackgroundImageUrl('javascript:void(0)').ok).toBe(false);
  });

  it('rejects background URLs with control characters', () => {
    expect(isSafeBackgroundUrl('https://example.com/a.jpg\n"), linear-gradient(red, blue)')).toBe(
      false
    );
    expect(isSafeBackgroundUrl('https://example.com/a.jpg\r\nfoo')).toBe(false);
  });
});
