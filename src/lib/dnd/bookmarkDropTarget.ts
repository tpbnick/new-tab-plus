export type GridFolderDropPosition = 'before' | 'after';

export type GridFolderDropResult =
  | {
      mode: 'into';
      gridColumnId: string;
      targetFolderId: string | null;
      position: GridFolderDropPosition;
    }
  | {
      mode: 'newColumn';
      beforeColumnId: string | null;
      lineX: number;
    };

export type LayoutColumnInsert = {
  beforeColumnId: string | null;
  lineX: number;
};

const COLUMN_SNAP_PX = 48;

function columnGapPx(leftRect: DOMRect, rightRect: DOMRect): number {
  return Math.max(0, rightRect.left - leftRect.right);
}

/** Gap width beside a column — matches the flex gap between columns when possible. */
function measureColumnGapPx(columns: HTMLElement[]): number {
  if (columns.length >= 2) {
    return columnGapPx(
      columns[0]!.getBoundingClientRect(),
      columns[1]!.getBoundingClientRect()
    );
  }
  return COLUMN_SNAP_PX;
}

type InsertZone = LayoutColumnInsert & { zoneLeft: number; zoneRight: number };

function buildInsertZones(
  columns: HTMLElement[]
): InsertZone[] {
  if (columns.length === 0) return [];

  const gap = measureColumnGapPx(columns);
  const zones: InsertZone[] = [];
  const firstRect = columns[0]!.getBoundingClientRect();

  zones.push({
    zoneLeft: firstRect.left - gap,
    zoneRight: firstRect.left,
    lineX: firstRect.left - gap / 2,
    beforeColumnId: columns[0]!.dataset.columnId ?? null,
  });

  for (let i = 0; i < columns.length - 1; i++) {
    const leftRect = columns[i]!.getBoundingClientRect();
    const rightRect = columns[i + 1]!.getBoundingClientRect();
    zones.push({
      zoneLeft: leftRect.right,
      zoneRight: rightRect.left,
      lineX: (leftRect.right + rightRect.left) / 2,
      beforeColumnId: columns[i + 1]!.dataset.columnId ?? null,
    });
  }

  const lastIndex = columns.length - 1;
  const lastRect = columns[lastIndex]!.getBoundingClientRect();

  zones.push({
    zoneLeft: lastRect.right,
    zoneRight: lastRect.right + gap,
    lineX: lastRect.right + gap / 2,
    beforeColumnId: null,
  });

  return zones;
}

function resolveInsertFromZones(zones: InsertZone[], clientX: number): LayoutColumnInsert | null {
  for (const zone of zones) {
    if (zone.zoneRight - zone.zoneLeft < 1) continue;
    if (clientX >= zone.zoneLeft && clientX <= zone.zoneRight) {
      return { beforeColumnId: zone.beforeColumnId, lineX: zone.lineX };
    }
  }

  let best: LayoutColumnInsert | null = null;
  let bestDistance = Infinity;
  for (const zone of zones) {
    const distance = Math.abs(clientX - zone.lineX);
    if (distance < bestDistance && distance <= COLUMN_SNAP_PX) {
      bestDistance = distance;
      best = { beforeColumnId: zone.beforeColumnId, lineX: zone.lineX };
    }
  }
  return best;
}

/** All layout columns in visual left-to-right order. */
function sortedLayoutColumns(gridHost: HTMLElement): HTMLElement[] {
  return [...gridHost.querySelectorAll<HTMLElement>('.column[data-column-id]')].sort(
    (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left
  );
}

function resolveFolderInColumn(
  gridColumn: HTMLElement,
  draggedFolderId: string,
  clientY: number
): Omit<Extract<GridFolderDropResult, { mode: 'into' }>, 'mode'> | null {
  const gridColumnId = gridColumn.dataset.gridColumnId;
  if (!gridColumnId) return null;

  const blocks = [...gridColumn.querySelectorAll<HTMLElement>('.folder-column-block')].filter(
    (block) => block.dataset.folderId !== draggedFolderId
  );

  if (blocks.length === 0) {
    if (gridColumn.querySelector(`[data-folder-id="${draggedFolderId}"]`)) return null;
    return { gridColumnId, targetFolderId: null, position: 'after' };
  }

  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    const folderId = block.dataset.folderId ?? null;

    if (clientY < rect.top) {
      return { gridColumnId, targetFolderId: folderId, position: 'before' };
    }

    if (clientY <= rect.bottom) {
      const header = block.querySelector<HTMLElement>('.folder-column-header');
      const headerBottom = header?.getBoundingClientRect().bottom ?? rect.top;

      if (clientY < headerBottom) {
        return { gridColumnId, targetFolderId: folderId, position: 'before' };
      }
      return { gridColumnId, targetFolderId: folderId, position: 'after' };
    }
  }

  const last = blocks[blocks.length - 1]!;
  return {
    gridColumnId,
    targetFolderId: last.dataset.folderId ?? null,
    position: 'after',
  };
}

/** Vertical insertion line between any layout columns (bookmark, special section, widget). */
export function resolveLayoutColumnInsert(
  gridHost: HTMLElement,
  clientX: number,
  clientY: number
): LayoutColumnInsert | null {
  const columns = sortedLayoutColumns(gridHost);
  const gridRect = gridHost.getBoundingClientRect();

  if (clientY < gridRect.top || clientY > gridRect.bottom) return null;

  if (columns.length === 0) {
    return { beforeColumnId: null, lineX: gridRect.left + gridRect.width / 2 };
  }

  return resolveInsertFromZones(buildInsertZones(columns), clientX);
}

function shouldPreferColumnInsertOverStack(
  gridHost: HTMLElement,
  clientX: number,
  insert: LayoutColumnInsert,
  sourceColumnId?: string | null
): boolean {
  const columns = sortedLayoutColumns(gridHost);
  if (columns.length === 0) return true;

  const gap = measureColumnGapPx(columns);

  if (insert.beforeColumnId !== null) {
    const target = columns.find((col) => col.dataset.columnId === insert.beforeColumnId);
    if (target) {
      const targetRect = target.getBoundingClientRect();
      const targetId = target.dataset.columnId ?? null;
      const inGapBeforeTarget =
        clientX >= targetRect.left - gap && clientX <= targetRect.left;
      const draggingOwnColumnLeft =
        sourceColumnId === targetId &&
        clientX >= targetRect.left - gap &&
        clientX <= targetRect.left + gap;
      if (inGapBeforeTarget || draggingOwnColumnLeft) {
        return true;
      }
    }
  } else {
    const last = columns[columns.length - 1]!;
    const lastRect = last.getBoundingClientRect();
    const lastId = last.dataset.columnId ?? null;
    const inGapAfterLast = clientX >= lastRect.right && clientX <= lastRect.right + gap;
    const draggingOwnColumnRight =
      sourceColumnId === lastId &&
      clientX >= lastRect.right - gap &&
      clientX <= lastRect.right + gap;
    if (inGapAfterLast || draggingOwnColumnRight) {
      return true;
    }
  }

  for (let i = 0; i < columns.length - 1; i++) {
    const leftRect = columns[i]!.getBoundingClientRect();
    const rightRect = columns[i + 1]!.getBoundingClientRect();
    const nextColumnId = columns[i + 1]!.dataset.columnId ?? null;
    if (
      insert.beforeColumnId === nextColumnId &&
      clientX >= leftRect.right &&
      clientX <= rightRect.left
    ) {
      return true;
    }
  }

  for (const col of columns) {
    const rect = col.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right) return false;
  }

  return false;
}

/** Bookmark grid column whose bounding box contains the pointer (geometry-only; no hit testing). */
function bookmarkGridColumnAtPoint(
  gridHost: HTMLElement,
  clientX: number,
  clientY: number
): HTMLElement | null {
  const gridRect = gridHost.getBoundingClientRect();
  if (
    clientY < gridRect.top ||
    clientY > gridRect.bottom ||
    clientX < gridRect.left ||
    clientX > gridRect.right
  ) {
    return null;
  }

  for (const gridColumn of gridHost.querySelectorAll<HTMLElement>('.column--bookmark-grid')) {
    const rect = gridColumn.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return gridColumn;
    }
  }

  return null;
}

export function resolveGridFolderDrop(
  gridHost: HTMLElement,
  draggedFolderId: string,
  clientX: number,
  clientY: number,
  skipBlock?: HTMLElement | null
): GridFolderDropResult | null {
  const sourceColumnId =
    skipBlock?.closest<HTMLElement>('.column[data-column-id]')?.dataset.columnId ?? null;
  const insert = resolveLayoutColumnInsert(gridHost, clientX, clientY);
  const gridColumn = bookmarkGridColumnAtPoint(gridHost, clientX, clientY);

  if (insert && shouldPreferColumnInsertOverStack(gridHost, clientX, insert, sourceColumnId)) {
    return { mode: 'newColumn', beforeColumnId: insert.beforeColumnId, lineX: insert.lineX };
  }

  if (gridColumn) {
    const folderTarget = resolveFolderInColumn(gridColumn, draggedFolderId, clientY);
    if (folderTarget) {
      return { mode: 'into', ...folderTarget };
    }
  }

  if (!insert) return null;
  return { mode: 'newColumn', beforeColumnId: insert.beforeColumnId, lineX: insert.lineX };
}

/** Block element used to position the horizontal drop indicator. */
export function getFolderDropLineTarget(
  gridHost: HTMLElement,
  folderId: string
): HTMLElement | null {
  return gridHost.querySelector<HTMLElement>(`.folder-column-block[data-folder-id="${folderId}"]`);
}

/** @internal */
export function buildInsertZonesForTest(columns: HTMLElement[]): InsertZone[] {
  return buildInsertZones(columns);
}

/** @internal */
export function resolveInsertFromZonesForTest(
  zones: InsertZone[],
  clientX: number
): LayoutColumnInsert | null {
  return resolveInsertFromZones(zones, clientX);
}
