import { describe, expect, it } from 'vitest';
import { createDefaultOptionsState } from '../storage/schema';
import {
  formatRgba,
  hasBackgroundImage,
  isLightBackgroundColor,
  parseRgba,
  readableTextColor,
  relativeLuminance,
  replaceRgbaColor,
  resolveEffectiveTextColor,
  resolveTextColorTokens,
  clampTextOpacityPct,
  rgbToHex,
  TEXT_OPACITY_MIN_PCT,
} from './colorUtils';

describe('colorUtils', () => {
  it('picks light text on dark backgrounds', () => {
    expect(readableTextColor('#15161e')).toBe('#e8e8f0');
    expect(readableTextColor('#000000')).toBe('#e8e8f0');
  });

  it('picks dark text on light backgrounds', () => {
    expect(readableTextColor('#ffffff')).toBe('#15161e');
    expect(readableTextColor('#f5f5f5')).toBe('#15161e');
  });

  it('parses rgb() colors', () => {
    expect(readableTextColor('rgb(255, 255, 255)')).toBe('#15161e');
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2);
  });

  it('resolves auto text color only without a background image', () => {
    const options = createDefaultOptionsState();
    options.theme.autoTextColor = true;
    options.theme.colors.text = '#ff0000';
    options.theme.colors.background = '#ffffff';

    expect(resolveEffectiveTextColor(options.theme, options.background)).toBe('#15161e');

    options.background.imageUrl = 'https://example.com/bg.jpg';
    expect(resolveEffectiveTextColor(options.theme, options.background)).toBe('#ff0000');
  });

  it('detects background images', () => {
    expect(hasBackgroundImage({ imageUrl: '', imageOpacityPct: 100, size: 'cover', align: 'center' })).toBe(false);
    expect(hasBackgroundImage({ imageUrl: '  ', imageOpacityPct: 100, size: 'cover', align: 'center' })).toBe(false);
    expect(hasBackgroundImage({ imageUrl: 'https://x/y.png', imageOpacityPct: 100, size: 'cover', align: 'center' })).toBe(true);
  });

  it('classifies light vs dark backgrounds', () => {
    expect(isLightBackgroundColor('#ffffff')).toBe(true);
    expect(isLightBackgroundColor('#15161e')).toBe(false);
  });

  it('keeps full text color at 100% visibility', () => {
    const tokens = resolveTextColorTokens('#e8e8f0', 100);
    expect(tokens.text).toBe('#e8e8f0');
    expect(tokens.heading).toBe('color-mix(in srgb, #e8e8f0 88%, transparent)');
    expect(tokens.muted).toBe('color-mix(in srgb, #e8e8f0 82%, transparent)');
  });

  it('scales text tokens down with visibility', () => {
    const tokens = resolveTextColorTokens('#e8e8f0', 50);
    expect(tokens.text).toBe('color-mix(in srgb, #e8e8f0 50%, transparent)');
    expect(tokens.heading).toBe('color-mix(in srgb, #e8e8f0 44%, transparent)');
    expect(tokens.muted).toBe('color-mix(in srgb, #e8e8f0 41%, transparent)');
  });

  it('clamps text visibility to a 30% floor', () => {
    expect(clampTextOpacityPct(0)).toBe(TEXT_OPACITY_MIN_PCT);
    expect(clampTextOpacityPct(15)).toBe(TEXT_OPACITY_MIN_PCT);
    expect(resolveTextColorTokens('#e8e8f0', 10).text).toBe(
      `color-mix(in srgb, #e8e8f0 ${TEXT_OPACITY_MIN_PCT}%, transparent)`
    );
  });

  it('parses rgba colors and preserves alpha when replacing rgb', () => {
    expect(parseRgba('rgba(255, 255, 255, 0.12)')).toEqual({ r: 255, g: 255, b: 255, a: 0.12 });
    expect(rgbToHex({ r: 21, g: 22, b: 30 })).toBe('#15161e');
    expect(replaceRgbaColor('rgba(255, 255, 255, 0.12)', { r: 21, g: 22, b: 30 })).toBe(
      'rgba(21, 22, 30, 0.12)'
    );
    expect(formatRgba(21, 22, 30, 0.35)).toBe('rgba(21, 22, 30, 0.35)');
  });
});
