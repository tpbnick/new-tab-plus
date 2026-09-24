/**
 * Moves `movedId` to just before `beforeId` (or to the end if `beforeId` is
 * null or not in the list). If `movedId` is already in `ids` and `beforeId`
 * is that same id, the list stays put — a column dropped on its own leading
 * edge must not jump to the end. If `movedId` is not in `ids`, it is inserted.
 */
export function reorderIds(ids: string[], movedId: string, beforeId: string | null): string[] {
  if (beforeId === movedId && ids.includes(movedId)) return [...ids];

  const result = ids.filter((id) => id !== movedId);

  if (beforeId === null) {
    result.push(movedId);
    return result;
  }

  const targetIndex = result.indexOf(beforeId);
  if (targetIndex === -1) {
    result.push(movedId);
  } else {
    result.splice(targetIndex, 0, movedId);
  }
  return result;
}
