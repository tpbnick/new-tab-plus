import { FONT_FAMILY_OPTIONS } from './fontFamilies';

const GOOGLE_FONT_LINK_ID = 'ntp-google-font';
const FONT_WEIGHTS = '300;400;500;600;700;800';

function googleFontsCssUrl(family: string): string {
  const familyParam = family.trim().replace(/\s+/g, '+');
  return `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${FONT_WEIGHTS}&display=swap`;
}

/** Loads (or unloads) the Google Font stylesheet for the selected font-family value. */
export function loadFontForFamily(fontFamilyValue: string, doc: Document = document): void {
  const option = FONT_FAMILY_OPTIONS.find((opt) => opt.value === fontFamilyValue);
  const googleFont = option?.googleFont;
  const existing = doc.getElementById(GOOGLE_FONT_LINK_ID) as HTMLLinkElement | null;

  if (!googleFont) {
    existing?.remove();
    return;
  }

  const href = googleFontsCssUrl(googleFont);
  if (existing?.href === href) return;

  const link = existing ?? doc.createElement('link');
  link.id = GOOGLE_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = href;
  if (!existing) doc.head.appendChild(link);
}
