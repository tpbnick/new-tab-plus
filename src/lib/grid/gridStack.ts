import type { BookmarkGridColumnMeta } from '../storage/schema';

export const SPECIAL_SECTION_PREFIX = 'special:';

type LegacyGridColumn = BookmarkGridColumnMeta & { folderIds?: string[] };

export function isSpecialSectionStackId(id: string): boolean {
  return id.startsWith(SPECIAL_SECTION_PREFIX);
}

export function gridColumnIdForStackItem(stackId: string): string {
  return `grid:${stackId}`;
}

/** Ordered stack entries in a grid column — bookmark folder ids or special: section ids. */
export function getColumnStack(col: BookmarkGridColumnMeta): string[] {
  if (Array.isArray(col.stack)) return col.stack;
  const legacy = col as LegacyGridColumn;
  return Array.isArray(legacy.folderIds) ? legacy.folderIds : [];
}

export function setColumnStack(col: BookmarkGridColumnMeta, stack: string[]): void {
  col.stack = stack;
}
