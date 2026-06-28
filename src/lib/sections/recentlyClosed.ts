import type { SectionItem } from './mostVisited';

type SessionTab = chrome.sessions.Session['tab'];

export function resolveRecentlyClosedUrl(tab: SessionTab): string {
  if (!tab) return '';
  return (tab.url ?? tab.pendingUrl ?? '').trim();
}

function ownExtensionUrlPrefix(): string | undefined {
  const id = typeof chrome !== 'undefined' ? chrome.runtime?.id : undefined;
  return id ? `chrome-extension://${id.toLowerCase()}/` : undefined;
}

/** Browser/extension new-tab pages that should not appear in Recently Closed. */
export function isHiddenRecentlyClosedUrl(url: string | undefined): boolean {
  const lower = (url ?? '').trim().toLowerCase();
  if (!lower) return false;

  const ownPrefix = ownExtensionUrlPrefix();
  if (ownPrefix && lower.startsWith(ownPrefix)) return true;
  if (lower.startsWith('brave://newtab')) return true;
  if (lower.startsWith('chrome://newtab')) return true;
  if (lower.startsWith('edge://newtab')) return true;
  if (lower === 'about:blank' || lower === 'about:newtab') return true;

  return false;
}

export function shouldSkipRecentlyClosedEntry(
  title: string | undefined,
  url: string | undefined
): boolean {
  const normalizedUrl = (url ?? '').trim();
  const normalizedTitle = (title ?? '').trim();

  if (isHiddenRecentlyClosedUrl(normalizedUrl)) return true;

  // Closed new-tab pages when sessions omit the URL.
  if (!normalizedUrl && (normalizedTitle === '' || normalizedTitle === 'Untitled')) {
    return true;
  }

  return false;
}

function firstUsableUrl(tabs: SessionTab[]): string {
  for (const tab of tabs) {
    const url = resolveRecentlyClosedUrl(tab);
    if (url && !shouldSkipRecentlyClosedEntry(tab?.title, url)) return url;
  }
  return '';
}

export async function getRecentlyClosed(itemCount = 8): Promise<SectionItem[]> {
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
  const items: SectionItem[] = [];

  for (const session of sessions) {
    if (items.length >= itemCount) break;

    if (session.tab) {
      if (!session.tab.sessionId) continue;

      const url = resolveRecentlyClosedUrl(session.tab);
      if (isHiddenRecentlyClosedUrl(url)) continue;

      const title = session.tab.title?.trim() || url || 'Closed tab';
      items.push({ title, url, sessionId: session.tab.sessionId });
    } else if (session.window) {
      const tabs = session.window.tabs ?? [];
      if (tabs.length === 0) continue;
      if (tabs.every((tab) => shouldSkipRecentlyClosedEntry(tab.title, resolveRecentlyClosedUrl(tab)))) {
        continue;
      }

      const url = firstUsableUrl(tabs);
      const label = tabs.length === 1 ? 'Window (1 tab)' : `Window (${tabs.length} tabs)`;
      items.push({ title: label, url, sessionId: session.window.sessionId });
    }
  }

  return items;
}
