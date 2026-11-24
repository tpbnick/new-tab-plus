import { describe, expect, it, vi } from 'vitest';
import { createDefaultOptionsState } from '../storage/schema';
import {
  applyBackground,
  applyCustomCss,
  applyTheme,
  formatBackgroundImageLayers,
} from './themeEngine';

describe('formatBackgroundImageLayers', () => {
  it('returns the image url alone at full opacity', () => {
    expect(formatBackgroundImageLayers('https://example.com/bg.jpg', '#15161e', 100)).toBe(
      'url("https://example.com/bg.jpg")'
    );
  });

  it('layers a color wash when opacity is below 100', () => {
    expect(formatBackgroundImageLayers('https://example.com/bg.jpg', '#15161e', 50)).toBe(
      'linear-gradient(rgba(21, 22, 30, 0.500), rgba(21, 22, 30, 0.500)), url("https://example.com/bg.jpg")'
    );
  });

  it('fully hides the image at 0% opacity', () => {
    expect(formatBackgroundImageLayers('https://example.com/bg.jpg', '#000000', 0)).toBe(
      'linear-gradient(rgba(0, 0, 0, 1.000), rgba(0, 0, 0, 1.000)), url("https://example.com/bg.jpg")'
    );
  });
});

describe('applyBackground', () => {
  it('uses the canonical URL and rejects control-character injection', () => {
    const root = document.createElement('div');
    applyBackground(
      { imageUrl: 'https://example.com/bg.jpg', imageOpacityPct: 100, size: 'cover', align: 'center' },
      '#15161e',
      root
    );
    expect(root.style.backgroundImage).toBe('url("https://example.com/bg.jpg")');

    applyBackground(
      {
        imageUrl: 'https://example.com/a.jpg\n"), linear-gradient(red, blue)',
        imageOpacityPct: 100,
        size: 'cover',
        align: 'center',
      },
      '#15161e',
      root
    );
    expect(root.style.backgroundImage).toBe('');
  });

  it('rejects svg data URLs for backgrounds', () => {
    const root = document.createElement('div');
    applyBackground(
      { imageUrl: 'data:image/svg+xml;base64,PHN2Zz4=', imageOpacityPct: 100, size: 'cover', align: 'center' },
      '#15161e',
      root
    );
    expect(root.style.backgroundImage).toBe('');
  });
});

describe('applyCustomCss', () => {
  it('removes previously applied CSS when the new stylesheet is invalid', () => {
    applyCustomCss('.column { color: red; }');
    expect(document.getElementById('user-custom-css')?.textContent).toContain('color: red');

    applyCustomCss('.column { color: red;');
    expect(document.getElementById('user-custom-css')).toBeNull();
  });

  it('removes previously applied CSS when the stylesheet is cleared', () => {
    applyCustomCss('.column { color: red; }');
    expect(document.getElementById('user-custom-css')).not.toBeNull();
    applyCustomCss('');
    expect(document.getElementById('user-custom-css')).toBeNull();
  });

  it('forwards custom Document to validation and style injection', () => {
    const customDoc = document.implementation.createHTMLDocument('custom-css');
    const createElementSpy = vi.spyOn(customDoc, 'createElement');

    const origSheet = globalThis.CSSStyleSheet;
    vi.stubGlobal('CSSStyleSheet', undefined);
    try {
      applyCustomCss('.column { color: blue; }', customDoc);
    } finally {
      vi.stubGlobal('CSSStyleSheet', origSheet);
    }

    expect(createElementSpy).toHaveBeenCalledWith('style');
    expect(customDoc.getElementById('user-custom-css')?.textContent).toBe('.column { color: blue; }');
  });
});

describe('applyTheme', () => {
  it('loads Google Fonts into root.ownerDocument', () => {
    const happyDomSettings = (
      window as unknown as {
        happyDOM?: {
          settings?: { disableCSSFileLoading?: boolean; handleDisabledFileLoadingAsSuccess?: boolean };
        };
      }
    ).happyDOM?.settings;
    const prevDisable = happyDomSettings?.disableCSSFileLoading;
    const prevSuccess = happyDomSettings?.handleDisabledFileLoadingAsSuccess;
    if (happyDomSettings) {
      happyDomSettings.disableCSSFileLoading = true;
      happyDomSettings.handleDisabledFileLoadingAsSuccess = true;
    }
    try {
      const customDoc = document.implementation.createHTMLDocument('theme-doc');
      const options = createDefaultOptionsState();
      options.theme.fontFamily = '"JetBrains Mono", Consolas, monospace';

      applyTheme(options.theme, options.background, customDoc.documentElement);

      const link = customDoc.getElementById('ntp-google-font') as HTMLLinkElement | null;
      expect(link).not.toBeNull();
      expect(link!.href).toContain('JetBrains+Mono');
    } finally {
      if (happyDomSettings) {
        happyDomSettings.disableCSSFileLoading = prevDisable;
        happyDomSettings.handleDisabledFileLoadingAsSuccess = prevSuccess;
      }
    }
  });
});
