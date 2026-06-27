import type { BookmarkGridColumnMeta } from './schema';

export interface LegacyBookmarkFolderColumn {
  type: 'bookmarkFolder';
  id: string;
  order: number;
  enabled: boolean;
  bookmarkId: string;
}

export function isLegacyBookmarkFolderColumn(col: unknown): col is LegacyBookmarkFolderColumn {
  return (
    typeof col === 'object' &&
    col !== null &&
    (col as LegacyBookmarkFolderColumn).type === 'bookmarkFolder' &&
    typeof (col as LegacyBookmarkFolderColumn).bookmarkId === 'string'
  );
}

export function legacyBookmarkFolderToGridColumn(col: LegacyBookmarkFolderColumn): BookmarkGridColumnMeta {
  return {
    id: col.id.startsWith('bm:') ? col.id.replace('bm:', 'grid:') : col.id,
    type: 'bookmarkGrid',
    order: col.order,
    enabled: col.enabled,
    stack: [col.bookmarkId],
  };
}
