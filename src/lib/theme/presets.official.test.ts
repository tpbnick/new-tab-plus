import { describe, expect, it } from 'vitest';
import { getThemePreset, THEME_PRESETS } from './presets';

/** Spot-checks that presets match their published palette sources. */
describe('official theme palette values', () => {
  it.each([
    [
      'atom-light',
      'Atom One Light Syntax',
      { text: '#383a42', background: '#fafafa', highlight: '#4078f2' },
    ],
    [
      'atom-dark',
      'Atom One Dark Syntax',
      { text: '#abb2bf', background: '#282c34', highlight: '#61afef' },
    ],
    [
      'one-dark',
      'Atom One Dark Syntax',
      { text: '#abb2bf', background: '#282c34', highlight: '#c678dd' },
    ],
    [
      'nord-dark',
      'Nord',
      { text: '#d8dee9', background: '#2e3440', highlight: '#88c0d0' },
    ],
    [
      'nord-light',
      'Nord',
      { text: '#2e3440', background: '#eceff4', highlight: '#5e81ac' },
    ],
    [
      'monokai-dark',
      'Monokai',
      { text: '#f8f8f2', background: '#272822', highlight: '#a6e22e' },
    ],
    [
      'monokai-light',
      'Monokai Pro Light',
      { text: '#29242a', background: '#faf4f2', highlight: '#1c8ca8' },
    ],
    [
      'dracula',
      'Dracula',
      { text: '#f8f8f2', background: '#282a36', highlight: '#bd93f9' },
    ],
    [
      'gruvbox-dark',
      'Gruvbox',
      { text: '#ebdbb2', background: '#282828', highlight: '#83a598' },
    ],
    [
      'solarized-dark',
      'Solarized',
      { text: '#839496', background: '#002b36', highlight: '#2aa198' },
    ],
    [
      'solarized-light',
      'Solarized',
      { text: '#657b83', background: '#fdf6e3', highlight: '#268bd2' },
    ],
    [
      'github-dark',
      'GitHub Primer',
      { text: '#e6edf3', background: '#0d1117', highlight: '#58a6ff' },
    ],
    [
      'github-light',
      'GitHub Primer',
      { text: '#1f2328', background: '#ffffff', highlight: '#0969da' },
    ],
  ] as const)('matches %s (%s)', (id, _label, colors) => {
    const preset = getThemePreset(id);
    expect(preset).toBeDefined();
    expect(preset!.colors.text).toBe(colors.text);
    expect(preset!.colors.background).toBe(colors.background);
    expect(preset!.colors.highlight).toBe(colors.highlight);
  });

  it('documents a source for every preset', () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.source.trim().length).toBeGreaterThan(0);
    }
  });
});
