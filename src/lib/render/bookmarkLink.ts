import { faviconUrl } from '../favicon';
import {
  configureExternalLink,
  isBrowserInternalUrl,
  navigateExternalUrl,
  safeNavigationUrl,
} from './externalLink';

export interface BookmarkLinkOptions {
  openLinksInSameTab: boolean;
}

export interface BookmarkLinkSpec {
  title: string;
  url?: string;
  /** When set, clicking restores this closed session instead of navigating. */
  sessionId?: string;
}

function markSessionRestoreFailed(link: HTMLAnchorElement, label: HTMLElement, title: string): void {
  link.title = 'Session expired or unavailable';
  link.classList.add('bookmark-link--error');
  label.textContent = `${title} (unavailable)`;
}

/** Renders a bookmark-list item with favicon, link, and label. */
export function renderBookmarkLinkItem(
  spec: BookmarkLinkSpec,
  options: BookmarkLinkOptions
): HTMLElement {
  const li = document.createElement('li');
  li.className = 'bookmark-item bookmark-item--link';

  if (spec.url) {
    const icon = document.createElement('img');
    icon.className = 'bookmark-favicon';
    icon.src = faviconUrl(spec.url);
    icon.width = 16;
    icon.height = 16;
    icon.alt = '';
    li.appendChild(icon);
  }

  const link = document.createElement('a');
  link.className = 'bookmark-link';
  link.title = spec.title;

  const label = document.createElement('span');
  label.className = 'bookmark-link__label';
  label.textContent = spec.title;

  if (spec.sessionId) {
    link.href = safeNavigationUrl(spec.url) ?? '#';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      void chrome.sessions.restore(spec.sessionId!).catch(() => {
        markSessionRestoreFailed(link, label, spec.title);
      });
    });
  } else {
    const safeUrl = safeNavigationUrl(spec.url);
    if (safeUrl) {
      link.href = safeUrl;
      configureExternalLink(link, options.openLinksInSameTab);
      if (isBrowserInternalUrl(safeUrl)) {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const openInSameTab = options.openLinksInSameTab && !event.ctrlKey && !event.metaKey;
          navigateExternalUrl(safeUrl, openInSameTab);
        });
        link.addEventListener('auxclick', (event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          navigateExternalUrl(safeUrl, false);
        });
      }
    } else {
      link.href = '#';
      link.addEventListener('click', (event) => event.preventDefault());
    }
  }

  link.appendChild(label);
  li.appendChild(link);
  return li;
}
