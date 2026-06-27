import { isAllowedNavigationUrl } from '../urlSafety';

export { isAllowedNavigationUrl } from '../urlSafety';

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

  if (openInSameTab) {
    window.location.assign(safe);
    return;
  }
  window.open(safe, '_blank', 'noopener,noreferrer');
}
