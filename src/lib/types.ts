export interface BookmarkNodeViewModel {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNodeViewModel[];
  collapsed: boolean;
}

/** One top-level Chrome bookmark folder shown inside a grid column. */
export interface BookmarkFolderViewModel {
  bookmarkId: string;
  title: string;
  /** Chrome bookmark id of this folder's parent (Bookmarks Bar / Other Bookmarks). */
  parentBookmarkId: string;
  /** True when this block groups loose links under a Chrome root (Bookmarks Bar / Other Bookmarks). */
  isSyntheticRoot: boolean;
  collapsed: boolean;
  children: BookmarkNodeViewModel[];
}

export type GridStackEntry =
  | { kind: 'folder'; folder: BookmarkFolderViewModel }
  | { kind: 'section'; sectionId: string };

/** A visual column in the bookmarks grid — contains stacked folders and special sections. */
export interface BookmarkColumnViewModel {
  id: string;
  order: number;
  enabled: boolean;
  stack: GridStackEntry[];
}
