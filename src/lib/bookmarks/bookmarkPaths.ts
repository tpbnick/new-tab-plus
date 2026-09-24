import { getColumnStack, isSpecialSectionStackId } from '../grid/gridStack';
import type { BookmarkGridColumnMeta, ColumnEntry, LayoutState } from '../storage/schema';

const PATH_PREFIX = 'path:';

type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;

export function isBookmarkPathKey(id: string): boolean {
  return id.startsWith(PATH_PREFIX);
}

/** Maps bookmark ids to a key that survives Chrome sync onto another browser. */
export function buildBookmarkPathMaps(tree: BookmarkNode[]): {
  idToPath: Map<string, string>;
  pathToId: Map<string, string>;
} {
  const idToPath = new Map<string, string>();
  const pathToId = new Map<string, string>();
  const roots = tree[0]?.children ?? [];

  for (const permanent of roots) {
    const base = `${PATH_PREFIX}${permanent.id}`;
    idToPath.set(permanent.id, base);
    pathToId.set(base, permanent.id);
    indexChildren(permanent.children ?? [], base, idToPath, pathToId);
  }

  return { idToPath, pathToId };
}

function indexChildren(
  children: BookmarkNode[],
  parentPath: string,
  idToPath: Map<string, string>,
  pathToId: Map<string, string>
): void {
  const seenTitles = new Map<string, number>();
  for (const child of children) {
    const title = child.title ?? '';
    const count = (seenTitles.get(title) ?? 0) + 1;
    seenTitles.set(title, count);
    const encoded = encodeURIComponent(title);
    const segment = count === 1 ? encoded : `${encoded}~${count}`;
    const path = `${parentPath}/${segment}`;
    idToPath.set(child.id, path);
    pathToId.set(path, child.id);
    if (child.children) indexChildren(child.children, path, idToPath, pathToId);
  }
}

export function collectBookmarkIds(tree: BookmarkNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (node: BookmarkNode): void => {
    ids.add(node.id);
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of tree) walk(node);
  return ids;
}

function remapBookmarkId(id: string, map: Map<string, string>): string | null {
  if (isSpecialSectionStackId(id)) return id;
  return map.get(id) ?? null;
}

/** Replace local bookmark ids with portable path keys for a cloud copy. */
export function layoutToPortableBookmarks(
  layout: LayoutState,
  idToPath: Map<string, string>
): LayoutState {
  return remapLayout(layout, (id) => remapBookmarkId(id, idToPath));
}

/**
 * Replace portable path keys with this browser's bookmark ids.
 * Raw ids are kept when they still exist locally (same-browser restore).
 */
export function layoutFromPortableBookmarks(
  layout: LayoutState,
  pathToId: Map<string, string>,
  localIds: Set<string>
): LayoutState {
  return remapLayout(layout, (id) => {
    if (isSpecialSectionStackId(id)) return id;
    if (isBookmarkPathKey(id)) return pathToId.get(id) ?? null;
    return localIds.has(id) ? id : null;
  });
}

function remapLayout(layout: LayoutState, mapId: (id: string) => string | null): LayoutState {
  const columns: ColumnEntry[] = [];
  for (const col of layout.columns) {
    if (col.type !== 'bookmarkGrid') {
      columns.push(col);
      continue;
    }

    const stack = getColumnStack(col).flatMap((id) => {
      const mapped = mapId(id);
      return mapped ? [mapped] : [];
    });
    if (stack.length === 0) continue;

    const suffix = col.id.startsWith('grid:') ? col.id.slice('grid:'.length) : null;
    const mappedSuffix = suffix ? mapId(suffix) : null;
    const remapped: BookmarkGridColumnMeta = {
      ...col,
      id: mappedSuffix ? `grid:${mappedSuffix}` : col.id,
      stack,
    };
    columns.push(remapped);
  }

  const folderState: LayoutState['folderState'] = {};
  for (const [key, value] of Object.entries(layout.folderState ?? {})) {
    const mapped = mapId(key);
    if (mapped) folderState[mapped] = value;
  }

  return { ...layout, columns, folderState };
}
