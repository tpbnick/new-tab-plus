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
    const mid = rect.top + rect.height / 2;

    if (clientY < mid) {
      return { gridColumnId, targetFolderId: folderId, position: 'before' };
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

function columnStripAtX(columns: HTMLElement[], clientX: number): HTMLElement | null {
  return (
    columns.find((col) => {
      const rect = col.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right;
    }) ?? null
  );
}

/**
 * Over a bookmark column, the folder moves above or below another folder.
 * In a gap, or in the margin beside the row, it becomes its own column.
 */
export function resolveGridFolderDrop(
  gridHost: HTMLElement,
  draggedFolderId: string,
  clientX: number,
  clientY: number
): GridFolderDropResult | null {
  const gridRect = gridHost.getBoundingClientRect();
  if (clientY < gridRect.top || clientY > gridRect.bottom) return null;

  const strip = columnStripAtX(sortedLayoutColumns(gridHost), clientX);
  if (strip) {
    if (!strip.classList.contains('column--bookmark-grid')) return null;
    const folderTarget = resolveFolderInColumn(strip, draggedFolderId, clientY);
    if (folderTarget) return { mode: 'into', ...folderTarget };
    return null;
  }

  const insert = resolveLayoutColumnInsert(gridHost, clientX, clientY);
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
