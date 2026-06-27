import type { BookmarkGridColumnMeta } from '../storage/schema';
import { getColumnStack } from '../grid/gridStack';

export type StackMoveDirection = 'up' | 'down' | 'left' | 'right';

export type StackKeyboardMoveAction =
  | { type: 'noop' }
  | {
      type: 'reorder-in-column';
      gridColumnId: string;
      folderId: string;
      beforeFolderId: string | null;
    }
  | {
      type: 'move-column';
      folderId: string;
      sourceGridColumnId: string;
      beforeColumnId: string | null;
    }
  | {
      type: 'move-to-column';
      folderId: string;
      sourceGridColumnId: string;
      targetGridColumnId: string;
    };

function sortedGridColumns(columns: BookmarkGridColumnMeta[]): BookmarkGridColumnMeta[] {
  return [...columns].sort((a, b) => a.order - b.order);
}

/** Resolves keyboard stack/column moves (Alt+Shift+arrow). */
export function resolveStackKeyboardMove(
  columns: BookmarkGridColumnMeta[],
  folderId: string,
  sourceGridColumnId: string,
  direction: StackMoveDirection
): StackKeyboardMoveAction {
  const sourceCol = columns.find((c) => c.id === sourceGridColumnId);
  if (!sourceCol) return { type: 'noop' };

  const stack = getColumnStack(sourceCol);
  const index = stack.indexOf(folderId);
  if (index === -1) return { type: 'noop' };

  const gridCols = sortedGridColumns(columns);
  const colIndex = gridCols.findIndex((c) => c.id === sourceGridColumnId);
  if (colIndex === -1) return { type: 'noop' };

  if (direction === 'up') {
    if (index === 0) return { type: 'noop' };
    return {
      type: 'reorder-in-column',
      gridColumnId: sourceGridColumnId,
      folderId,
      beforeFolderId: stack[index - 1]!,
    };
  }

  if (direction === 'down') {
    if (index >= stack.length - 1) return { type: 'noop' };
    return {
      type: 'reorder-in-column',
      gridColumnId: sourceGridColumnId,
      folderId,
      beforeFolderId: stack[index + 2] ?? null,
    };
  }

  if (direction === 'left') {
    if (colIndex === 0) return { type: 'noop' };
    const targetCol = gridCols[colIndex - 1]!;
    if (stack.length === 1) {
      return {
        type: 'move-column',
        folderId,
        sourceGridColumnId,
        beforeColumnId: targetCol.id,
      };
    }
    return {
      type: 'move-to-column',
      folderId,
      sourceGridColumnId,
      targetGridColumnId: targetCol.id,
    };
  }

  if (colIndex >= gridCols.length - 1) return { type: 'noop' };
  const targetCol = gridCols[colIndex + 1]!;
  if (stack.length === 1) {
    return {
      type: 'move-column',
      folderId,
      sourceGridColumnId,
      beforeColumnId: gridCols[colIndex + 2]?.id ?? null,
    };
  }
  return {
    type: 'move-to-column',
    folderId,
    sourceGridColumnId,
    targetGridColumnId: targetCol.id,
  };
}
