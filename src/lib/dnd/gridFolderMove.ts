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

/**
 * Drop slots are captured before a split. When the slot was the source column
 * and that column was renamed or removed, retarget the slot so the new column
 * stays in the gap under the pointer.
 */
export function insertBeforeIdAfterColumnSplit(
  orderedColumnIds: readonly string[],
  sourceColumnId: string,
  beforeColumnId: string | null,
  sourceColumnIdAfterSplit: string | null
): string | null {
  if (beforeColumnId !== sourceColumnId) return beforeColumnId;
  if (sourceColumnIdAfterSplit) return sourceColumnIdAfterSplit;

  const sourceIndex = orderedColumnIds.indexOf(sourceColumnId);
  if (sourceIndex === -1) return null;
  return orderedColumnIds[sourceIndex + 1] ?? null;
}
