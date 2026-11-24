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
      lineTop?: number;
      lineHeight?: number;
    };

type LayoutColumnInsert = {
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
  columns: HTMLElement[],
  afterLastBeforeColumnId: string | null = null
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
    beforeColumnId: afterLastBeforeColumnId,
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

interface VisualRow {
  columns: HTMLElement[];
  top: number;
  bottom: number;
}

function verticallyOverlaps(topA: number, bottomA: number, topB: number, bottomB: number): boolean {
  if (topA === bottomA || topB === bottomB) {
    return topA <= bottomB && topB <= bottomA;
  }
  return topA < bottomB && topB < bottomA;
}

/** Group layout columns into visual flex-wrap rows sorted top-to-bottom, then left-to-right. */
function visualColumnRows(gridHost: HTMLElement): VisualRow[] {
  const entries = [...gridHost.querySelectorAll<HTMLElement>('.column[data-column-id]')]
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

  const rows: VisualRow[] = [];
  for (const { el, rect } of entries) {
    const match = rows.find((row) => verticallyOverlaps(rect.top, rect.bottom, row.top, row.bottom));
    if (match) {
      match.columns.push(el);
      match.top = Math.min(match.top, rect.top);
      match.bottom = Math.max(match.bottom, rect.bottom);
    } else {
      rows.push({ columns: [el], top: rect.top, bottom: rect.bottom });
    }
  }

  for (const row of rows) {
    row.columns.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  }
  return rows;
}

function activeVisualRowAtY(
  rows: VisualRow[],
  clientY: number
): { row: VisualRow; nextRowFirstColumnId: string | null } | null {
  if (rows.length === 0) return null;

  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const dist =
      clientY < row.top ? row.top - clientY : clientY > row.bottom ? clientY - row.bottom : 0;
    if (dist < bestDistance) {
      bestDistance = dist;
      bestIndex = i;
      if (dist === 0) break;
    }
  }

  const nextRowFirstColumnId = rows[bestIndex + 1]?.columns[0]?.dataset.columnId ?? null;
  return { row: rows[bestIndex]!, nextRowFirstColumnId };
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

  const active = activeVisualRowAtY(visualColumnRows(gridHost), clientY);
  if (!active) {
    return {
      mode: 'newColumn',
      beforeColumnId: null,
      lineX: gridRect.left + gridRect.width / 2,
      lineTop: gridRect.top,
      lineHeight: gridRect.height,
    };
  }

  const strip = columnStripAtX(active.row.columns, clientX);
  if (strip) {
    if (!strip.classList.contains('column--bookmark-grid')) return null;
    const folderTarget = resolveFolderInColumn(strip, draggedFolderId, clientY);
    if (folderTarget) return { mode: 'into', ...folderTarget };
    return null;
  }

  const insert = resolveInsertFromZones(
    buildInsertZones(active.row.columns, active.nextRowFirstColumnId),
    clientX
  );
  if (!insert) return null;
  return {
    mode: 'newColumn',
    beforeColumnId: insert.beforeColumnId,
    lineX: insert.lineX,
    lineTop: active.row.top,
    lineHeight: Math.max(0, active.row.bottom - active.row.top),
  };
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
