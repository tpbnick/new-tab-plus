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

  it('blocks chrome URLs for backgrounds', () => {
    expect(isSafeBackgroundUrl('chrome://theme/IDR_THEME_NTP_BACKGROUND')).toBe(false);
  });

  it('validates background image URL field input', () => {
    expect(validateBackgroundImageUrl('')).toEqual({ ok: true });
    expect(validateBackgroundImageUrl('https://example.com/a.jpg')).toEqual({ ok: true });
    expect(validateBackgroundImageUrl('javascript:void(0)').ok).toBe(false);
  });
});
