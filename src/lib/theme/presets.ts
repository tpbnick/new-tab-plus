import type { OptionsState, ThemeCustomSnapshot } from '../storage/schema';

export type ThemePresetColors = OptionsState['theme']['colors'];

export interface ThemePreset {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  colors: ThemePresetColors;
  /** Where these colors come from (editor palette / design system). */
  source: string;
}

const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO_FONT = '"JetBrains Mono", Consolas, "Courier New", monospace';

export const THEME_PRESET_CUSTOM_ID = 'custom';

/**
 * Font and color presets only — spacing, gaps, and column width are unchanged when applied.
 *
 * Field mapping for each official palette:
 * - text → default foreground / body text
 * - background → editor / canvas background
 * - highlight → primary accent (links, selection, keywords)
 * - highlightText → foreground on highlight
 * - shadow → official border, guide, or comment tone
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'atom-light',
    name: 'Atom Light',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Atom One Light Syntax (atom/one-light-syntax)',
    colors: {
      text: '#383a42', // mono-1
      background: '#fafafa', // syntax-bg
      highlight: '#4078f2', // hue-2 blue
      highlightText: '#ffffff',
      shadow: 'rgba(56, 58, 66, 0.2)', // syntax-guide ~20% mono-1
    },
  },
  {
    id: 'atom-dark',
    name: 'Atom Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Atom One Dark Syntax (atom/one-dark-syntax)',
    colors: {
      text: '#abb2bf', // mono-1
      background: '#282c34', // syntax-bg
      highlight: '#61afef', // hue-2 blue
      highlightText: '#282c34',
      shadow: 'rgba(92, 99, 112, 0.35)', // mono-3 #5c6370
    },
  },
  {
    id: 'nord-light',
    name: 'Nord Light',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Nord (nordtheme/nord)',
    colors: {
      text: '#2e3440', // nord0
      background: '#eceff4', // nord6
      highlight: '#5e81ac', // nord10
      highlightText: '#eceff4',
      shadow: 'rgba(76, 86, 106, 0.35)', // nord3 #4c566a
    },
  },
  {
    id: 'nord-dark',
    name: 'Nord Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Nord (nordtheme/nord)',
    colors: {
      text: '#d8dee9', // nord4
      background: '#2e3440', // nord0
      highlight: '#88c0d0', // nord8
      highlightText: '#2e3440',
      shadow: 'rgba(76, 86, 106, 0.35)', // nord3 #4c566a
    },
  },
  {
    id: 'monokai-light',
    name: 'Monokai Light',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Monokai Pro Light (monokai-pro)',
    colors: {
      text: '#29242a',
      background: '#faf4f2',
      highlight: '#1c8ca8', // accent5
      highlightText: '#faf4f2',
      shadow: 'rgba(191, 185, 186, 0.45)', // dimmed4 #bfb9ba
    },
  },
  {
    id: 'monokai-dark',
    name: 'Monokai Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Monokai (textmate/monokai.tmbundle)',
    colors: {
      text: '#f8f8f2',
      background: '#272822',
      highlight: '#a6e22e',
      highlightText: '#272822',
      shadow: 'rgba(117, 113, 94, 0.4)', // comment #75715e
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Atom One Dark Syntax (atom/one-dark-syntax)',
    colors: {
      text: '#abb2bf', // mono-1
      background: '#282c34', // syntax-bg
      highlight: '#c678dd', // hue-3 purple
      highlightText: '#282c34',
      shadow: 'rgba(92, 99, 112, 0.35)', // mono-3 #5c6370
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Dracula Theme (draculatheme.com)',
    colors: {
      text: '#f8f8f2',
      background: '#282a36',
      highlight: '#bd93f9',
      highlightText: '#282a36',
      shadow: 'rgba(98, 114, 164, 0.35)', // comment #6272a4
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Gruvbox (morhetz/gruvbox)',
    colors: {
      text: '#ebdbb2', // gruvbox fg
      background: '#282828', // gruvbox bg0
      highlight: '#83a598', // gruvbox blue/aqua
      highlightText: '#282828',
      shadow: 'rgba(146, 131, 116, 0.35)', // gruvbox gray #928374
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Solarized (ethanschoonover.com/solarized)',
    colors: {
      text: '#657b83', // base00
      background: '#fdf6e3', // base3
      highlight: '#268bd2', // blue
      highlightText: '#fdf6e3',
      shadow: 'rgba(147, 161, 161, 0.35)', // base1 #93a1a1
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'Solarized (ethanschoonover.com/solarized)',
    colors: {
      text: '#839496', // base0
      background: '#002b36', // base03
      highlight: '#2aa198', // cyan
      highlightText: '#002b36',
      shadow: 'rgba(88, 110, 117, 0.35)', // base01 #586e75
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'GitHub Primer (primer.style)',
    colors: {
      text: '#1f2328', // fg.default
      background: '#ffffff', // canvas.default
      highlight: '#0969da', // accent.fg
      highlightText: '#ffffff',
      shadow: 'rgba(209, 217, 224, 0.85)', // border.default #d1d9e0
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'GitHub Primer (primer.style)',
    colors: {
      text: '#e6edf3', // fg.default
      background: '#0d1117', // canvas.default
      highlight: '#58a6ff', // accent emphasis / link blue
      highlightText: '#0d1117',
      shadow: 'rgba(48, 54, 61, 0.85)', // border.default #30363d
    },
  },
  {
    id: 'night-dark',
    name: 'Night Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'new-tab-plus default',
    colors: {
      text: '#e8e8f0',
      background: '#15161e',
      highlight: '#6fa8dc',
      highlightText: '#15161e',
      shadow: 'rgba(255, 255, 255, 0.12)',
    },
  },
  {
    id: 'oled-dark',
    name: 'OLED Dark',
    fontFamily: SYSTEM_FONT,
    fontWeight: 400,
    source: 'new-tab-plus (true black OLED)',
    colors: {
      text: '#e8e8e8',
      background: '#000000',
      highlight: '#ffffff',
      highlightText: '#000000',
      shadow: 'rgba(255, 255, 255, 0.1)',
    },
  },
  {
    id: 'hacker',
    name: 'Hacker',
    fontFamily: MONO_FONT,
    fontWeight: 400,
    source: 'Classic terminal / Matrix green',
    colors: {
      text: '#33ff33',
      background: '#0a0a0a',
      highlight: '#00ff41',
      highlightText: '#0a0a0a',
      shadow: 'rgba(51, 255, 51, 0.2)',
    },
  },
];

const presetById = new Map(THEME_PRESETS.map((preset) => [preset.id, preset]));

export function getThemePreset(id: string): ThemePreset | undefined {
  return presetById.get(id);
}

function themeMatchesPreset(theme: OptionsState['theme'], preset: ThemePreset): boolean {
  return (
    theme.fontFamily === preset.fontFamily &&
    theme.fontWeight === preset.fontWeight &&
    theme.colors.text === preset.colors.text &&
    theme.colors.background === preset.colors.background &&
    theme.colors.highlight === preset.colors.highlight &&
    theme.colors.highlightText === preset.colors.highlightText &&
    theme.colors.shadow === preset.colors.shadow
  );
}

/** Resolves the active preset id from stored theme values. */
export function detectThemePresetId(theme: OptionsState['theme']): string {
  if (theme.presetId === THEME_PRESET_CUSTOM_ID) return THEME_PRESET_CUSTOM_ID;

  if (theme.presetId && theme.presetId !== THEME_PRESET_CUSTOM_ID) {
    const stored = getThemePreset(theme.presetId);
    if (stored && themeMatchesPreset(theme, stored)) return theme.presetId;
  }
  for (const preset of THEME_PRESETS) {
    if (themeMatchesPreset(theme, preset)) return preset.id;
  }
  return THEME_PRESET_CUSTOM_ID;
}

export function snapshotThemeFields(theme: OptionsState['theme']): ThemeCustomSnapshot {
  return {
    fontFamily: theme.fontFamily,
    fontWeight: theme.fontWeight,
    colors: { ...theme.colors },
    autoTextColor: theme.autoTextColor,
  };
}

/** Saves the current font/color settings as Custom and selects that preset. */
export function saveCustomThemeSnapshot(theme: OptionsState['theme']): void {
  theme.customSnapshot = snapshotThemeFields(theme);
  theme.presetId = THEME_PRESET_CUSTOM_ID;
}

/** Restores the saved Custom font/color settings. */
export function applyCustomThemeSnapshot(theme: OptionsState['theme']): void {
  theme.presetId = THEME_PRESET_CUSTOM_ID;
  theme.fontFamily = theme.customSnapshot.fontFamily;
  theme.fontWeight = theme.customSnapshot.fontWeight;
  theme.colors = { ...theme.customSnapshot.colors };
  theme.autoTextColor = theme.customSnapshot.autoTextColor;
}

/** Applies font and color fields from a preset; leaves spacing and layout theme fields untouched. */
export function applyThemePreset(theme: OptionsState['theme'], preset: ThemePreset): void {
  theme.presetId = preset.id;
  theme.fontFamily = preset.fontFamily;
  theme.fontWeight = preset.fontWeight;
  theme.colors = { ...preset.colors };
  theme.autoTextColor = false;
}

export function themePresetChoices(): Array<{ value: string; label: string }> {
  return [
    { value: THEME_PRESET_CUSTOM_ID, label: 'Custom' },
    ...THEME_PRESETS.map((preset) => ({ value: preset.id, label: preset.name })),
  ];
}
