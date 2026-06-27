import type { OptionsState } from '../storage/schema';
import { isLightBackgroundColor, parseCssColor, resolveEffectiveTextColor, resolveTextColorTokens } from './colorUtils';
import { loadFontForFamily } from './fontLoader';
import { applyLinkHoverOptions } from './linkHover';
import { validateCustomCss } from './customCssValidate';
import { isSafeBackgroundUrl } from '../urlSafety';

export { validateCustomCss, type CustomCssValidation } from './customCssValidate';

const CUSTOM_CSS_STYLE_ID = 'user-custom-css';

export function applyTheme(
  theme: OptionsState['theme'],
  background: OptionsState['background'] = { imageUrl: '', imageOpacityPct: 100, size: 'cover', align: 'center' },
  root: HTMLElement = document.documentElement
): void {
  loadFontForFamily(theme.fontFamily);
  const textColor = resolveEffectiveTextColor(theme, background);
  const textTokens = resolveTextColorTokens(textColor, theme.textOpacityPct);
  root.style.setProperty('--ntp-font-family', theme.fontFamily);
  root.style.setProperty('--ntp-font-weight', String(theme.fontWeight));
  root.style.setProperty('--ntp-font-size', `${theme.fontSizePx}px`);
  root.style.setProperty('--ntp-color-text', textTokens.text);
  root.style.setProperty('--ntp-color-text-muted', textTokens.muted);
  root.style.setProperty('--ntp-color-text-heading', textTokens.heading);
  root.style.setProperty('--ntp-color-background', theme.colors.background);
  root.style.colorScheme = isLightBackgroundColor(theme.colors.background) ? 'light' : 'dark';
  root.style.setProperty('--ntp-color-highlight', theme.colors.highlight);
  root.style.setProperty('--ntp-color-shadow', theme.colors.shadow);
  applyFolderHeaderColor(theme, root);
  root.style.setProperty('--ntp-spacing-unit', `${theme.spacing * 12}px`);
  root.style.setProperty('--ntp-column-width', `${theme.columnWidth}px`);
  root.style.setProperty('--ntp-title-transform', theme.uppercaseFolderNames ? 'uppercase' : 'none');
  root.style.setProperty('--ntp-top-spacing', `${theme.topSpacingPx}px`);
  root.style.setProperty('--ntp-region-gap', `${theme.regionGapPx}px`);
  applyLinkHoverOptions(theme, root);
}

function applyFolderHeaderColor(
  theme: OptionsState['theme'],
  root: HTMLElement = document.documentElement
): void {
  const color = theme.useHighlightForFolderHeaders
    ? theme.colors.highlight
    : theme.folderHeaderColor;
  root.style.setProperty('--ntp-color-folder-header', color);
}

export function applyGeneralOptions(
  general: OptionsState['general'],
  root: HTMLElement = document.documentElement
): void {
  root.style.setProperty('--folder-collapse-duration', `${general.folderCollapseAnimationMs}ms`);
}

function cssUrl(value: string): string {
  return `url("${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
}

function clampOpacityPct(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Builds a layered background-image value that dims the photo toward a solid color. */
export function formatBackgroundImageLayers(
  imageUrl: string,
  overlayColor: string,
  opacityPct: number
): string {
  const url = cssUrl(imageUrl);
  const opacity = clampOpacityPct(opacityPct);
  if (opacity >= 100) return url;

  const rgb = parseCssColor(overlayColor);
  if (!rgb) return url;

  const overlayAlpha = 1 - opacity / 100;
  const rgba = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${overlayAlpha.toFixed(3)})`;
  return `linear-gradient(${rgba}, ${rgba}), ${url}`;
}

export function applyBackground(
  background: OptionsState['background'],
  overlayColor: string = '#15161e',
  root: HTMLElement = document.body
): void {
  const imageUrl = background.imageUrl.trim();
  if (!imageUrl || !isSafeBackgroundUrl(imageUrl)) {
    root.style.backgroundImage = '';
    return;
  }
  root.style.backgroundImage = formatBackgroundImageLayers(
    imageUrl,
    overlayColor,
    background.imageOpacityPct
  );
  root.style.backgroundSize = background.size === 'repeat' ? 'auto' : background.size;
  root.style.backgroundRepeat = background.size === 'repeat' ? 'repeat' : 'no-repeat';
  root.style.backgroundPosition = background.align;
}

export function applyCustomCss(css: string, doc: Document = document): void {
  const validation = validateCustomCss(css);
  if (!validation.ok) return;

  let styleEl = doc.getElementById(CUSTOM_CSS_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = CUSTOM_CSS_STYLE_ID;
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}
