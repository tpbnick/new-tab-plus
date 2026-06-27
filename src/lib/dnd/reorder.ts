/**
 * Moves `movedId` to just before `beforeId` in the list (or to the end if
 * `beforeId` is null or not found). If `movedId` is not already in `ids`,
 * it is inserted (cross-column folder moves).
 */
export function reorderIds(ids: string[], movedId: string, beforeId: string | null): string[] {
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
