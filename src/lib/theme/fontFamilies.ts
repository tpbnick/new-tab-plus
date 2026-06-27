export interface FontFamilyOption {
  label: string;
  value: string;
  /** When set, the font is fetched from Google Fonts on selection. */
  googleFont?: string;
}

/** Popular font stacks for the theme picker. Each value is a full CSS font-family list. */
export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { label: 'System default', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif', googleFont: 'Inter' },
  { label: 'Roboto', value: 'Roboto, Arial, sans-serif', googleFont: 'Roboto' },
  { label: 'Open Sans', value: '"Open Sans", Arial, sans-serif', googleFont: 'Open Sans' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif', googleFont: 'Merriweather' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, monospace', googleFont: 'JetBrains Mono' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
];

/** Resolves a stored font-family to a dropdown value, falling back to system default. */
export function resolveFontFamilyValue(stored: string): string {
  const match = FONT_FAMILY_OPTIONS.find((opt) => opt.value === stored);
  return match?.value ?? FONT_FAMILY_OPTIONS[0].value;
}
