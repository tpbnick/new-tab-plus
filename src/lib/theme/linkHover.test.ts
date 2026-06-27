import { describe, expect, it } from 'vitest';
import { createDefaultOptionsState, mergeOptionsState } from '../storage/schema';
import {
  applyLinkHoverOptions,
  clampLinkHoverGrowPct,
  linkHoverScaleFromGrowPct,
  normalizeLinkHoverEffect,
} from './linkHover';

describe('linkHover', () => {
  it('defaults to color effect with 105% grow and 200ms duration', () => {
    const theme = createDefaultOptionsState().theme;
    expect(theme.linkHoverEffect).toBe('color');
    expect(theme.linkHoverGrowPct).toBe(105);
    expect(theme.linkHoverDurationMs).toBe(200);
  });

  it('snaps grow percentage to 5% steps between 105 and 120', () => {
    expect(clampLinkHoverGrowPct(90)).toBe(105);
    expect(clampLinkHoverGrowPct(100)).toBe(105);
    expect(clampLinkHoverGrowPct(108)).toBe(110);
    expect(clampLinkHoverGrowPct(122)).toBe(120);
    expect(linkHoverScaleFromGrowPct(105)).toBe(1.05);
    expect(linkHoverScaleFromGrowPct(110)).toBe(1.1);
  });

  it('normalizes unknown effects to color', () => {
    expect(normalizeLinkHoverEffect('nope')).toBe('color');
    expect(normalizeLinkHoverEffect('glow')).toBe('glow');
  });

  it('merges and applies hover settings to the document root', () => {
    const merged = mergeOptionsState({
      theme: { linkHoverEffect: 'grow', linkHoverGrowPct: 108, linkHoverDurationMs: 150 },
    } as Partial<import('../storage/schema').OptionsState>);
    const root = {
      dataset: {} as DOMStringMap,
      style: { setProperty: (name: string, value: string) => props.set(name, value) },
    };
    const props = new Map<string, string>();
    applyLinkHoverOptions(merged.theme, root as unknown as HTMLElement);
    expect(root.dataset.linkHoverEffect).toBe('grow');
    expect(props.get('--ntp-link-hover-scale')).toBe('1.1');
    expect(props.get('--ntp-link-hover-duration')).toBe('150ms');
  });
});
