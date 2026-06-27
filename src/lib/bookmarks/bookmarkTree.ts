import type { LayoutState, BookmarkGridColumnMeta, SpecialSectionMeta } from '../storage/schema';
import { coerceLayoutState, normalizeLayoutColumns } from '../storage/layoutNormalize';
import {
  getColumnStack,
  isSpecialSectionStackId,
  gridColumnIdForStackItem,
} from '../grid/gridStack';
import type { BookmarkColumnViewModel, BookmarkFolderViewModel, BookmarkNodeViewModel, GridStackEntry } from '../types';

type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;

function isFolder(node: BookmarkNode): boolean {
  return node.children !== undefined;
}

interface FolderCandidate {
  bookmarkId: string;
  title: string;
  node: BookmarkNode;
  parentBookmarkId: string;
  isSyntheticRoot: boolean;
}

function collectFolderCandidates(tree: BookmarkNode[]): FolderCandidate[] {
  const syntheticRoot = tree[0];
  const permanentRoots = syntheticRoot?.children ?? [];
  const candidates: FolderCandidate[] = [];

  for (const root of permanentRoots) {
    const children = root.children ?? [];
    const looseBookmarks: BookmarkNode[] = [];

    for (const child of children) {
      if (isFolder(child)) {
        candidates.push({
          bookmarkId: child.id,
          title: child.title,
          node: child,
          parentBookmarkId: root.id,
          isSyntheticRoot: false,
        });
      } else {
        looseBookmarks.push(child);
      }
    }

    if (looseBookmarks.length > 0) {
      candidates.push({
        bookmarkId: root.id,
        title: root.title,
        node: { ...root, children: looseBookmarks },
        parentBookmarkId: root.id,
        isSyntheticRoot: true,
      });
    }
  }

  return candidates;
}

function toNodeViewModel(node: BookmarkNode, folderState: LayoutState['folderState']): BookmarkNodeViewModel {
  if (!isFolder(node)) {
    return { id: node.id, title: node.title, url: node.url, collapsed: false };
  }

  return {
    id: node.id,
    title: node.title,
    collapsed: folderState[node.id]?.collapsed ?? false,
    children: (node.children ?? []).map((child) => toNodeViewModel(child, folderState)),
  };
}

function buildFolderViewModel(
  candidate: FolderCandidate,
  layout: LayoutState
): BookmarkFolderViewModel {
  return {
    bookmarkId: candidate.bookmarkId,
    title: candidate.title,
    parentBookmarkId: candidate.parentBookmarkId,
    isSyntheticRoot: candidate.isSyntheticRoot,
    collapsed: layout.folderState[candidate.bookmarkId]?.collapsed ?? false,
    children: (candidate.node.children ?? []).map((child) => toNodeViewModel(child, layout.folderState)),
  };
}

function enabledSectionIds(layout: LayoutState): Set<string> {
  return new Set(
    layout.columns
      .filter((c): c is SpecialSectionMeta => c.type === 'specialSection' && c.enabled)
      .map((c) => c.id)
  );
}

function filterPersistedStackIds(
  stackIds: string[],
  candidateById: Map<string, FolderCandidate>
): string[] {
  return stackIds.filter((id) =>
    isSpecialSectionStackId(id) ? true : candidateById.has(id)
  );
}

function buildStackEntries(
  stackIds: string[],
  candidateById: Map<string, FolderCandidate>,
  layout: LayoutState,
  sections: Set<string>
): GridStackEntry[] {
  const entries: GridStackEntry[] = [];
  for (const id of stackIds) {
    if (isSpecialSectionStackId(id)) {
      if (sections.has(id)) {
        entries.push({ kind: 'section', sectionId: id });
      }
      continue;
    }
    const candidate = candidateById.get(id);
    if (!candidate) continue;
    entries.push({ kind: 'folder', folder: buildFolderViewModel(candidate, layout) });
  }
  return entries;
}

export interface ReconciliationResult {
  layout: LayoutState;
  columns: BookmarkColumnViewModel[];
}

/** Strip bookmark grid columns and rebuild one column per top-level folder. */
export function resetBookmarkGridLayout(layout: LayoutState, tree: BookmarkNode[]): LayoutState {
  const candidates = collectFolderCandidates(tree);
  const sectionGridColumns = layout.columns.filter(
    (c): c is BookmarkGridColumnMeta =>
      c.type === 'bookmarkGrid' && getColumnStack(c).every(isSpecialSectionStackId)
  );
  const nonGridColumns = layout.columns.filter((c) => c.type !== 'bookmarkGrid');

  let nextOrder = [...nonGridColumns, ...sectionGridColumns].reduce((max, c) => Math.max(max, c.order), -1) + 1;
  const gridColumns: BookmarkGridColumnMeta[] = candidates.map((candidate) => ({
    id: gridColumnIdForStackItem(candidate.bookmarkId),
    type: 'bookmarkGrid',
    order: nextOrder++,
    enabled: true,
    stack: [candidate.bookmarkId],
  }));

  return {
    ...layout,
    columns: [...nonGridColumns, ...sectionGridColumns, ...gridColumns].sort((a, b) => a.order - b.order),
  };
}

function gridColumnsUnchanged(
  next: BookmarkGridColumnMeta[],
  prev: BookmarkGridColumnMeta[]
): boolean {
  if (next.length !== prev.length) return false;
  const prevById = new Map(prev.map((col) => [col.id, col]));
  return next.every((col) => {
    const existing = prevById.get(col.id);
    const nextStack = getColumnStack(col);
    const prevStack = existing ? getColumnStack(existing) : [];
    return (
      existing &&
      col.enabled === existing.enabled &&
      col.order === existing.order &&
      nextStack.length === prevStack.length &&
      nextStack.every((id, index) => id === prevStack[index])
    );
  });
}

function dedupeStackAcrossColumns(columns: BookmarkGridColumnMeta[]): BookmarkGridColumnMeta[] {
  const seenBookmarks = new Set<string>();
  const seenSections = new Set<string>();
  return columns
    .map((col) => ({
      ...col,
      stack: getColumnStack(col).filter((id) => {
        if (isSpecialSectionStackId(id)) {
          if (seenSections.has(id)) return false;
          seenSections.add(id);
          return true;
        }
        if (seenBookmarks.has(id)) return false;
        seenBookmarks.add(id);
        return true;
      }),
    }))
    .filter((col) => getColumnStack(col).length > 0);
}

/**
 * Reconciles the live Chrome bookmark tree with persisted layout.
 * Visual grid columns group separate top-level folders and special sections —
 * folders are NOT nested in Chrome when moved between columns; only layout.stack changes.
 */
export function reconcileBookmarkColumns(tree: BookmarkNode[], layout: LayoutState): ReconciliationResult {
  layout = normalizeLayoutColumns(coerceLayoutState(layout));
  const candidates = collectFolderCandidates(tree);
  const candidateById = new Map(candidates.map((c) => [c.bookmarkId, c]));
  const sections = enabledSectionIds(layout);

  const existingGridColumns = layout.columns.filter(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid'
  );
  const otherColumns = layout.columns.filter((c) => c.type !== 'bookmarkGrid');

  let gridColumns: BookmarkGridColumnMeta[] = dedupeStackAcrossColumns(
    existingGridColumns
      .map((col) => ({
        ...col,
        stack: filterPersistedStackIds(getColumnStack(col), candidateById),
      }))
      .filter((col) => getColumnStack(col).length > 0)
  );

  const assignedFolderIds = new Set(
    gridColumns.flatMap((col) => getColumnStack(col).filter((id) => !isSpecialSectionStackId(id)))
  );

  let nextOrder = layout.columns.reduce((max, c) => Math.max(max, c.order), -1) + 1;
  const newGridColumns: BookmarkGridColumnMeta[] = [];

  for (const candidate of candidates) {
    if (assignedFolderIds.has(candidate.bookmarkId)) continue;
    newGridColumns.push({
      id: gridColumnIdForStackItem(candidate.bookmarkId),
      type: 'bookmarkGrid',
      order: nextOrder++,
      enabled: true,
      stack: [candidate.bookmarkId],
    });
    assignedFolderIds.add(candidate.bookmarkId);
  }

  gridColumns = [...gridColumns, ...newGridColumns].sort((a, b) => a.order - b.order);

  const stackedSectionIds = new Set(
    gridColumns.flatMap((col) => getColumnStack(col).filter(isSpecialSectionStackId))
  );
  const restoredSectionColumns: BookmarkGridColumnMeta[] = [];
  for (const sectionId of sections) {
    if (stackedSectionIds.has(sectionId)) continue;
    const sectionMeta = layout.columns.find(
      (c): c is SpecialSectionMeta => c.type === 'specialSection' && c.id === sectionId
    );
    restoredSectionColumns.push({
      id: gridColumnIdForStackItem(sectionId),
      type: 'bookmarkGrid',
      order: sectionMeta?.order ?? nextOrder++,
      enabled: true,
      stack: [sectionId],
    });
    stackedSectionIds.add(sectionId);
  }
  if (restoredSectionColumns.length > 0) {
    gridColumns = [...gridColumns, ...restoredSectionColumns].sort((a, b) => a.order - b.order);
  }

  const reconciledColumns = [...otherColumns, ...gridColumns].sort((a, b) => a.order - b.order);

  const unchanged =
    newGridColumns.length === 0 &&
    restoredSectionColumns.length === 0 &&
    gridColumnsUnchanged(gridColumns, existingGridColumns);

  const reconciledLayout: LayoutState = unchanged
    ? layout
    : {
        ...layout,
        columns: reconciledColumns,
      };

  const columns: BookmarkColumnViewModel[] = gridColumns
    .map((meta) => ({
      id: meta.id,
      order: meta.order,
      enabled: meta.enabled,
      stack: buildStackEntries(getColumnStack(meta), candidateById, layout, sections),
    }))
    .filter((col) => col.stack.length > 0);

  return { layout: reconciledLayout, columns };
}
