import { flattenBookmarkLinks, type BookmarkSearchEntry } from '../../lib/search/bookmarkSearchIndex';
import { appState } from './state';

function bookmarkTreeSignature(tree: chrome.bookmarks.BookmarkTreeNode[]): string {
  const parts: string[] = [];
  function walk(nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[]): void {
    for (const node of nodes) {
      if (node.url) {
        parts.push(`${node.id}|${node.title}|${node.url}|${path.join(' › ')}`);
      }
      if (node.children?.length) {
        walk(node.children, [...path, node.title]);
      }
    }
  }
  for (const root of tree[0]?.children ?? []) {
    walk(root.children ?? [], [root.title]);
  }
  return parts.join('\n');
}

export function updateBookmarkSearchIndex(tree: chrome.bookmarks.BookmarkTreeNode[]): void {
  const sig = bookmarkTreeSignature(tree);
  if (sig === appState.lastBookmarkTreeSig) return;
  appState.lastBookmarkTreeSig = sig;
  appState.bookmarkSearchEntries = flattenBookmarkLinks(tree);
}

export function getBookmarkSearchEntries(): BookmarkSearchEntry[] {
  return appState.bookmarkSearchEntries;
}
