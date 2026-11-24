import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FONT_FAMILY_OPTIONS } from './fontFamilies';
import { loadFontForFamily } from './fontLoader';

const happyDomSettings = (
  window as unknown as {
    happyDOM?: {
      settings?: { disableCSSFileLoading?: boolean; handleDisabledFileLoadingAsSuccess?: boolean };
    };
  }
).happyDOM?.settings;

describe('loadFontForFamily', () => {
  let prevDisableCss: boolean | undefined;
  let prevHandleSuccess: boolean | undefined;

  beforeEach(() => {
    prevDisableCss = happyDomSettings?.disableCSSFileLoading;
    prevHandleSuccess = happyDomSettings?.handleDisabledFileLoadingAsSuccess;
    if (happyDomSettings) {
      happyDomSettings.disableCSSFileLoading = true;
      happyDomSettings.handleDisabledFileLoadingAsSuccess = true;
    }
  });

  afterEach(() => {
    if (happyDomSettings) {
      happyDomSettings.disableCSSFileLoading = prevDisableCss;
      happyDomSettings.handleDisabledFileLoadingAsSuccess = prevHandleSuccess;
    }
  });

  it('requests only weights 400;700 for Atkinson Hyperlegible', () => {
    const doc = document.implementation.createHTMLDocument('font-test');
    const atkinson = FONT_FAMILY_OPTIONS.find((opt) => opt.label === 'Atkinson Hyperlegible');
    expect(atkinson).toBeDefined();

    loadFontForFamily(atkinson!.value, doc);
    const link = doc.getElementById('ntp-google-font') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link!.href).toBe(
      'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap'
    );
  });

  it('uses default weights for other Google Fonts and removes link for system fonts', () => {
    const doc = document.implementation.createHTMLDocument('font-test');
    const jetbrains = FONT_FAMILY_OPTIONS.find((opt) => opt.label === 'JetBrains Mono');
    expect(jetbrains).toBeDefined();

    loadFontForFamily(jetbrains!.value, doc);
    const link = doc.getElementById('ntp-google-font') as HTMLLinkElement | null;
    expect(link!.href).toBe(
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap'
    );

    loadFontForFamily(FONT_FAMILY_OPTIONS[0].value, doc);
    expect(doc.getElementById('ntp-google-font')).toBeNull();
  });
});
