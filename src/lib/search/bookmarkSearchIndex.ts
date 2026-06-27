export interface BookmarkSearchEntry {
  id: string;
  title: string;
  url: string;
  /** Folder breadcrumb, e.g. "Bookmarks Bar › Work" */
  path: string;
}

type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;

export function flattenBookmarkLinks(tree: BookmarkNode[]): BookmarkSearchEntry[] {
  const results: BookmarkSearchEntry[] = [];

  function walk(nodes: BookmarkNode[], path: string[]): void {
    for (const node of nodes) {
      if (node.url) {
        results.push({
          id: node.id,
          title: node.title,
          url: node.url,
          path: path.join(' › '),
        });
      }
      if (node.children?.length) {
        walk(node.children, [...path, node.title]);
      }
    }
  }

  const chromeRoots = tree[0]?.children ?? [];
  for (const root of chromeRoots) {
    walk(root.children ?? [], [root.title]);
  }

  return results;
}

function scoreEntry(entry: BookmarkSearchEntry, query: string): number {
  const title = entry.title.toLowerCase();
  const url = entry.url.toLowerCase();
  const path = entry.path.toLowerCase();

  if (title.startsWith(query)) return 100;
  if (title.includes(query)) return 80;
  if (path.includes(query)) return 60;
  if (url.includes(query)) return 40;
  return 0;
}

export function searchBookmarkEntries(
  entries: BookmarkSearchEntry[],
  query: string,
  limit = 8
): BookmarkSearchEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, normalized) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map(({ entry }) => entry);
}
