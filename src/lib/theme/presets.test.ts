import { describe, expect, it } from 'vitest';
import { createDefaultOptionsState } from '../storage/schema';
import {
  applyCustomThemeSnapshot,
  applyThemePreset,
  detectThemePresetId,
  getThemePreset,
  saveCustomThemeSnapshot,
  THEME_PRESET_CUSTOM_ID,
} from './presets';

describe('theme presets', () => {
  it('detects the default theme as Night Dark', () => {
    const theme = createDefaultOptionsState().theme;
    expect(detectThemePresetId(theme)).toBe('night-dark');
  });

  it('applies only font and color fields from a preset', () => {
    const options = createDefaultOptionsState();
    const beforeSpacing = options.theme.spacing;
    const beforeGap = options.theme.regionGapPx;
    const preset = getThemePreset('hacker');
    expect(preset).toBeDefined();

    applyThemePreset(options.theme, preset!);

    expect(options.theme.fontFamily).toContain('JetBrains Mono');
    expect(options.theme.colors.text).toBe('#33ff33');
    expect(options.theme.spacing).toBe(beforeSpacing);
    expect(options.theme.regionGapPx).toBe(beforeGap);
    expect(detectThemePresetId(options.theme)).toBe('hacker');
  });

  it('returns custom when colors were edited away from a preset', () => {
    const options = createDefaultOptionsState();
    applyThemePreset(options.theme, getThemePreset('atom-dark')!);
    options.theme.colors.text = '#ffffff';
    expect(detectThemePresetId(options.theme)).toBe(THEME_PRESET_CUSTOM_ID);
  });

  it('keeps custom selected even when colors match a named preset', () => {
    const options = createDefaultOptionsState();
    applyThemePreset(options.theme, getThemePreset('atom-dark')!);
    saveCustomThemeSnapshot(options.theme);

    expect(detectThemePresetId(options.theme)).toBe(THEME_PRESET_CUSTOM_ID);
    expect(themeMatchesAtomDark(options.theme)).toBe(true);
  });

  it('restores the last custom snapshot after switching presets', () => {
    const options = createDefaultOptionsState();
    options.theme.colors.text = '#c0ffee';
    saveCustomThemeSnapshot(options.theme);

    applyThemePreset(options.theme, getThemePreset('dracula')!);
    expect(options.theme.colors.text).toBe('#f8f8f2');

    applyCustomThemeSnapshot(options.theme);
    expect(options.theme.colors.text).toBe('#c0ffee');
    expect(detectThemePresetId(options.theme)).toBe(THEME_PRESET_CUSTOM_ID);
  });
});

function themeMatchesAtomDark(theme: { colors: { text: string; background: string } }): boolean {
  const atom = getThemePreset('atom-dark')!;
  return theme.colors.text === atom.colors.text && theme.colors.background === atom.colors.background;
}
