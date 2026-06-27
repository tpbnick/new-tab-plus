import type { OptionsState } from '../storage/schema';
import { snapPercent } from '../ui/percentSnap';

export const LINK_HOVER_EFFECTS = [
  'color',
  'grow',
  'lift',
  'glow',
  'underline',
  'brighten',
  'none',
] as const;

export type LinkHoverEffect = (typeof LINK_HOVER_EFFECTS)[number];

export const LINK_HOVER_EFFECT_LABELS: Record<LinkHoverEffect, string> = {
  color: 'Color only',
  grow: 'Grow',
  lift: 'Lift',
  glow: 'Glow',
  underline: 'Underline',
  brighten: 'Brighten',
  none: 'None',
};

export const LINK_HOVER_GROW_PCT_MIN = 105;
export const LINK_HOVER_GROW_PCT_MAX = 120;
export const LINK_HOVER_DURATION_MS_MIN = 80;
export const LINK_HOVER_DURATION_MS_MAX = 500;

export function normalizeLinkHoverEffect(value: unknown): LinkHoverEffect {
  if (typeof value === 'string' && LINK_HOVER_EFFECTS.includes(value as LinkHoverEffect)) {
    return value as LinkHoverEffect;
  }
  return 'color';
}

export function clampLinkHoverGrowPct(value: number): number {
  if (!Number.isFinite(value)) return LINK_HOVER_GROW_PCT_MIN;
  return snapPercent(value, LINK_HOVER_GROW_PCT_MIN, LINK_HOVER_GROW_PCT_MAX);
}

export function clampLinkHoverDurationMs(value: number): number {
  if (!Number.isFinite(value)) return 200;
  return Math.min(LINK_HOVER_DURATION_MS_MAX, Math.max(LINK_HOVER_DURATION_MS_MIN, Math.round(value)));
}

export function linkHoverScaleFromGrowPct(growPct: number): number {
  return clampLinkHoverGrowPct(growPct) / 100;
}

/** Applies bookmark link hover effect settings as CSS variables and a data attribute. */
export function applyLinkHoverOptions(
  theme: Pick<OptionsState['theme'], 'linkHoverEffect' | 'linkHoverGrowPct' | 'linkHoverDurationMs'>,
  root: HTMLElement = document.documentElement
): void {
  const effect = normalizeLinkHoverEffect(theme.linkHoverEffect);
  const growPct = clampLinkHoverGrowPct(theme.linkHoverGrowPct);
  const durationMs = clampLinkHoverDurationMs(theme.linkHoverDurationMs);

  root.dataset.linkHoverEffect = effect;
  root.style.setProperty('--ntp-link-hover-scale', String(linkHoverScaleFromGrowPct(growPct)));
  root.style.setProperty('--ntp-link-hover-duration', `${durationMs}ms`);
}

export function linkHoverEffectChoices(): Array<{ value: LinkHoverEffect; label: string }> {
  return LINK_HOVER_EFFECTS.map((value) => ({ value, label: LINK_HOVER_EFFECT_LABELS[value] }));
}
