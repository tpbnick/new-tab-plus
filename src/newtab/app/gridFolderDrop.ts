import { reorderIds } from '../../lib/dnd/reorder';
import type { GridFolderDropResult } from '../../lib/dnd/bookmarkDropTarget';
import {
  collectGridColumnIds,
  gridColumnIdForFolder,
  reIdSourceColumnAfterNamesakeSplit,
} from '../../lib/dnd/gridFolderMove';
import { getColumnStack, setColumnStack } from '../../lib/grid/gridStack';
import { resolveStackKeyboardMove, type StackMoveDirection } from '../../lib/dnd/keyboardStackMove';
import { dndLog, dndWarn } from '../../lib/debug/dndDebug';
import type { BookmarkGridColumnMeta } from '../../lib/storage/schema';
import { appState, markLayoutDirty } from './state';

export type PersistLayoutAndRender = () => Promise<void>;

export function reorderLayoutColumns(movedColumnId: string, beforeColumnId: string | null): void {
  markLayoutDirty();
  const sorted = [...appState.layoutState.columns].sort((a, b) => a.order - b.order);
  const orderedIds = reorderIds(
    sorted.map((c) => c.id),
    movedColumnId,
    beforeColumnId
  );
  const byId = new Map(sorted.map((c) => [c.id, c]));

  orderedIds.forEach((id, i) => {
    const column = byId.get(id);
    if (column) column.order = i;
  });

  appState.layoutState.columns = orderedIds.map((id) => byId.get(id)!);
}

export async function handleStackKeyboardMove(
  folderId: string,
  sourceGridColumnId: string,
  direction: StackMoveDirection,
  persistLayoutAndRender: PersistLayoutAndRender
): Promise<void> {
  if (appState.optionsState.general.lockColumns) return;

  const gridCols = appState.layoutState.columns.filter(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid'
  );
  const action = resolveStackKeyboardMove(gridCols, folderId, sourceGridColumnId, direction);

  switch (action.type) {
    case 'noop':
      return;
    case 'reorder-in-column': {
      const col = appState.layoutState.columns.find(
        (c): c is BookmarkGridColumnMeta =>
          c.type === 'bookmarkGrid' && c.id === action.gridColumnId
      );
      if (!col) return;
      setColumnStack(col, reorderIds(getColumnStack(col), action.folderId, action.beforeFolderId));
      markLayoutDirty();
      await persistLayoutAndRender();
      return;
    }
    case 'move-column':
      await handleGridFolderNewColumn(
        action.folderId,
        action.sourceGridColumnId,
        action.beforeColumnId,
        persistLayoutAndRender
      );
      return;
    case 'move-to-column': {
      const targetCol = appState.layoutState.columns.find(
        (c): c is BookmarkGridColumnMeta =>
          c.type === 'bookmarkGrid' && c.id === action.targetGridColumnId
      );
      if (!targetCol) return;
      const targetStack = getColumnStack(targetCol);
      const lastId = targetStack[targetStack.length - 1] ?? null;
      if (lastId) {
        await handleGridFolderIntoColumn(
          action.folderId,
          action.sourceGridColumnId,
          action.targetGridColumnId,
          lastId,
          'after',
          persistLayoutAndRender
        );
      } else {
        await handleGridFolderIntoColumn(
          action.folderId,
          action.sourceGridColumnId,
          action.targetGridColumnId,
          null,
          'before',
          persistLayoutAndRender
        );
      }
    }
  }
}

export async function handleGridFolderDrop(
  folderId: string,
  sourceGridColumnId: string,
  target: GridFolderDropResult,
  persistLayoutAndRender: PersistLayoutAndRender
): Promise<void> {
  if (target.mode === 'newColumn') {
    await handleGridFolderNewColumn(
      folderId,
      sourceGridColumnId,
      target.beforeColumnId,
      persistLayoutAndRender
    );
    return;
  }
  await handleGridFolderIntoColumn(
    folderId,
    sourceGridColumnId,
    target.gridColumnId,
    target.targetFolderId,
    target.position,
    persistLayoutAndRender
  );
}

export async function handleGridFolderIntoColumn(
  folderId: string,
  sourceGridColumnId: string,
  targetGridColumnId: string,
  targetFolderId: string | null,
  position: 'before' | 'after',
  persistLayoutAndRender: PersistLayoutAndRender
): Promise<void> {
  dndLog('handleGridFolderIntoColumn', {
    folderId,
    sourceGridColumnId,
    targetGridColumnId,
    targetFolderId,
    position,
  });

  const sourceCol = appState.layoutState.columns.find(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid' && c.id === sourceGridColumnId
  );
  const targetCol = appState.layoutState.columns.find(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid' && c.id === targetGridColumnId
  );
  if (!sourceCol || !targetCol) {
    dndWarn('handleGridFolderIntoColumn aborted: grid column not found', {
      sourceGridColumnId,
      targetGridColumnId,
    });
    return;
  }

  markLayoutDirty();
  let targetStack = [...getColumnStack(targetCol)];
  if (sourceGridColumnId === targetGridColumnId) {
    targetStack = targetStack.filter((id) => id !== folderId);
  } else {
    setColumnStack(sourceCol, getColumnStack(sourceCol).filter((id) => id !== folderId));
  }

  let beforeFolderId: string | null = null;
  if (targetFolderId === null) {
    beforeFolderId = null;
  } else if (position === 'before') {
    beforeFolderId = targetFolderId;
  } else {
    const idx = targetStack.indexOf(targetFolderId);
    beforeFolderId = idx === -1 ? null : (targetStack[idx + 1] ?? null);
  }

  setColumnStack(targetCol, reorderIds(targetStack, folderId, beforeFolderId));

  dndLog('handleGridFolderIntoColumn result', {
    folderId,
    targetGridColumnId: targetCol.id,
    stack: getColumnStack(targetCol),
  });

  appState.layoutState.columns = appState.layoutState.columns.filter(
    (c) => c.type !== 'bookmarkGrid' || getColumnStack(c).length > 0
  );

  await persistLayoutAndRender();
}

export async function handleGridFolderNewColumn(
  folderId: string,
  sourceGridColumnId: string,
  beforeColumnId: string | null,
  persistLayoutAndRender: PersistLayoutAndRender
): Promise<void> {
  dndLog('handleGridFolderNewColumn', { folderId, sourceGridColumnId, beforeColumnId });

  const sourceCol = appState.layoutState.columns.find(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid' && c.id === sourceGridColumnId
  );
  if (!sourceCol) {
    dndWarn('handleGridFolderNewColumn aborted: source column not found', { sourceGridColumnId });
    return;
  }

  markLayoutDirty();
  const sourceStack = getColumnStack(sourceCol);
  const newColId = gridColumnIdForFolder(folderId);
  const isSoloColumnMove =
    sourceGridColumnId === newColId && sourceStack.length === 1 && sourceStack[0] === folderId;

  if (isSoloColumnMove) {
    reorderLayoutColumns(newColId, beforeColumnId);
    dndLog('handleGridFolderNewColumn result (solo reorder)', {
      folderId,
      newColId,
      beforeColumnId,
    });
    await persistLayoutAndRender();
    return;
  }

  setColumnStack(sourceCol, sourceStack.filter((id) => id !== folderId));

  const gridCols = appState.layoutState.columns.filter(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid'
  );
  const takenColumnIds = collectGridColumnIds(gridCols);
  reIdSourceColumnAfterNamesakeSplit(sourceCol, folderId, takenColumnIds);

  appState.layoutState.columns = appState.layoutState.columns.filter(
    (c) => c.type !== 'bookmarkGrid' || getColumnStack(c).length > 0
  );

  let newCol = appState.layoutState.columns.find(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid' && c.id === newColId
  );
  if (!newCol) {
    const maxOrder = appState.layoutState.columns.reduce((max, c) => Math.max(max, c.order), -1);
    newCol = {
      id: newColId,
      type: 'bookmarkGrid',
      order: maxOrder + 1,
      enabled: true,
      stack: [folderId],
    };
    appState.layoutState.columns.push(newCol);
  } else {
    setColumnStack(
      newCol,
      reorderIds(
        getColumnStack(newCol).filter((id) => id !== folderId),
        folderId,
        null
      )
    );
  }

  reorderLayoutColumns(newColId, beforeColumnId);

  dndLog('handleGridFolderNewColumn result', {
    folderId,
    newColId,
    beforeColumnId,
    stack: getColumnStack(newCol),
    allGridColumns: appState.layoutState.columns
      .filter((c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid')
      .map((c) => ({ id: c.id, stack: getColumnStack(c) })),
  });

  await persistLayoutAndRender();
}
