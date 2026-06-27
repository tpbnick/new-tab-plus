import type { BookmarkGridColumnMeta } from '../storage/schema';
import { getColumnStack, gridColumnIdForStackItem } from '../grid/gridStack';

export { gridColumnIdForStackItem as gridColumnIdForFolder } from '../grid/gridStack';

/**
 * When splitting folder X out of column grid:X that still has other folders,
 * rename the source column so a new grid:X column can hold the split folder.
 */
export function reIdSourceColumnAfterNamesakeSplit(
  sourceCol: BookmarkGridColumnMeta,
  splitFolderId: string,
  takenColumnIds: Set<string>
): void {
  const namesakeId = gridColumnIdForStackItem(splitFolderId);
  const sourceStack = getColumnStack(sourceCol);
  if (sourceCol.id !== namesakeId || sourceStack.length === 0) return;

  const firstRemaining = sourceStack[0]!;
  let nextId = gridColumnIdForStackItem(firstRemaining);
  if (takenColumnIds.has(nextId) && nextId !== sourceCol.id) {
    nextId = `grid:stack:${firstRemaining}`;
  }

  takenColumnIds.delete(sourceCol.id);
  sourceCol.id = nextId;
  takenColumnIds.add(nextId);
}

export function collectGridColumnIds(columns: BookmarkGridColumnMeta[]): Set<string> {
  return new Set(columns.map((c) => c.id));
}
