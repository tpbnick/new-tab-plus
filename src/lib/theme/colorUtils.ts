import type { OptionsState } from '../storage/schema';
import { snapPercent } from '../ui/percentSnap';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

function linearizeChannel(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function parseCssColor(value: string): Rgb | null {
  const trimmed = value.trim();
  const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(trimmed);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  return null;
}

export function parseRgba(value: string): (Rgb & { a: number }) | null {
  const trimmed = value.trim();
  const rgbaMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/.exec(
    trimmed
  );
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }

  const rgb = parseCssColor(trimmed);
  if (rgb) return { ...rgb, a: 1 };
  return null;
}

export function rgbToHex(rgb: Rgb): string {
  const channel = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

export function formatRgba(r: number, g: number, b: number, a: number): string {
  const alpha = Math.min(1, Math.max(0, a));
  const alphaText = Number.isInteger(alpha * 1000)
    ? String(alpha)
    : alpha.toFixed(3).replace(/\.?0+$/, '');
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alphaText})`;
}

export function replaceRgbaColor(value: string, rgb: Rgb): string {
  const parsed = parseRgba(value);
  return formatRgba(rgb.r, rgb.g, rgb.b, parsed?.a ?? 0.12);
}

export function relativeLuminance(rgb: Rgb): number {
  const r = linearizeChannel(rgb.r);
  const g = linearizeChannel(rgb.g);
  const b = linearizeChannel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Light text on dark backgrounds, dark text on light backgrounds. */
export function readableTextColor(background: string): string {
  const rgb = parseCssColor(background);
  if (!rgb) return '#e8e8f0';
  return relativeLuminance(rgb) > 0.179 ? '#15161e' : '#e8e8f0';
}

export function hasBackgroundImage(background: OptionsState['background']): boolean {
  return Boolean(background.imageUrl.trim());
}

export function resolveEffectiveTextColor(
  theme: OptionsState['theme'],
  background: OptionsState['background']
): string {
  if (theme.autoTextColor && !hasBackgroundImage(background)) {
    return readableTextColor(theme.colors.background);
  }
  return theme.colors.text;
}

export function isLightBackgroundColor(background: string): boolean {
  const rgb = parseCssColor(background);
  if (!rgb) return false;
  return relativeLuminance(rgb) > 0.5;
}

export const TEXT_OPACITY_MIN_PCT = 30;
export const TEXT_OPACITY_MAX_PCT = 100;

export function clampTextOpacityPct(value: number): number {
  return snapPercent(value, TEXT_OPACITY_MIN_PCT, TEXT_OPACITY_MAX_PCT);
}

function mixTextOpacity(baseColor: string, amountPct: number): string {
  const pct = Math.min(100, Math.max(0, Math.round(amountPct)));
  if (pct >= 100) return baseColor;
  return `color-mix(in srgb, ${baseColor} ${pct}%, transparent)`;
}

export interface TextColorTokens {
  text: string;
  muted: string;
  heading: string;
}

/** Applies visibility scaling to primary, heading, and muted text tokens. */
export function resolveTextColorTokens(baseTextColor: string, opacityPct: number): TextColorTokens {
  const visibility = clampTextOpacityPct(opacityPct);
  const headingMix = 88;
  const mutedMix = 82;

  if (visibility >= TEXT_OPACITY_MAX_PCT) {
    return {
      text: baseTextColor,
      heading: mixTextOpacity(baseTextColor, headingMix),
      muted: mixTextOpacity(baseTextColor, mutedMix),
    };
  }

  return {
    text: mixTextOpacity(baseTextColor, visibility),
    heading: mixTextOpacity(baseTextColor, Math.round((visibility * headingMix) / 100)),
    muted: mixTextOpacity(baseTextColor, Math.round((visibility * mutedMix) / 100)),
  };
}
