import type { GridFolderDropResult } from './bookmarkDropTarget';

export function gridFolderDropEquals(
  a: GridFolderDropResult | null,
  b: GridFolderDropResult | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.mode !== b.mode) return false;

  if (a.mode === 'newColumn' && b.mode === 'newColumn') {
    return a.beforeColumnId === b.beforeColumnId && a.lineX === b.lineX;
  }

  if (a.mode === 'into' && b.mode === 'into') {
    return (
      a.gridColumnId === b.gridColumnId &&
      a.targetFolderId === b.targetFolderId &&
      a.position === b.position
    );
  }

  return false;
}
