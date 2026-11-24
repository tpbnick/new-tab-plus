import { isAllowedNavigationUrl, parseSafeUrl } from '../urlSafety';

export { isAllowedNavigationUrl } from '../urlSafety';

/** True for browser-internal URLs (e.g. chrome://) that require chrome.tabs navigation. */
export function isBrowserInternalUrl(url: string): boolean {
  const parsed = parseSafeUrl(url);
  return parsed !== null && parsed.protocol === 'chrome:';
}

/** Apply user preference for whether links open in this tab or a new one. */
export function configureExternalLink(anchor: HTMLAnchorElement, openInSameTab: boolean): void {
  if (openInSameTab) {
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  } else {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
}

export function safeNavigationUrl(url: string | undefined): string | null {
  if (!url || !isAllowedNavigationUrl(url)) return null;
  return url.trim();
}

export function navigateExternalUrl(url: string, openInSameTab: boolean): void {
  const safe = safeNavigationUrl(url);
  if (!safe) return;

  if (isBrowserInternalUrl(safe) && typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      if (openInSameTab && typeof chrome.tabs.update === 'function') {
        void Promise.resolve(chrome.tabs.update({ url: safe })).catch(() => {});
        return;
      }
      if (!openInSameTab && typeof chrome.tabs.create === 'function') {
        void Promise.resolve(chrome.tabs.create({ url: safe })).catch(() => {});
        return;
      }
    } catch {
      return;
    }
  }

  if (openInSameTab) {
    window.location.assign(safe);
    return;
  }
  window.open(safe, '_blank', 'noopener,noreferrer');
}
