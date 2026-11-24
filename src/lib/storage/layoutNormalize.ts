import { dedupeBuiltinWidgetColumns, isTopBarWidget } from '../widgets/widgetLayout';
import {
  SCHEMA_VERSION,
  createDefaultLayoutState,
  type BookmarkGridColumnMeta,
  type ColumnEntry,
  type LayoutState,
} from './schema';
import {
  isLegacyBookmarkFolderColumn,
  legacyBookmarkFolderToGridColumn,
  type LegacyBookmarkFolderColumn,
} from './legacyLayoutColumn';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function repairGridColumn(col: BookmarkGridColumnMeta): BookmarkGridColumnMeta {
  if (Array.isArray(col.stack)) {
    const allStrings = col.stack.every((item) => typeof item === 'string');
    if (allStrings) return col;
    return {
      ...col,
      stack: col.stack.filter((item): item is string => typeof item === 'string'),
    };
  }

  const legacy = col as BookmarkGridColumnMeta & { folderIds?: unknown[]; bookmarkId?: unknown };
  if (Array.isArray(legacy.folderIds)) {
    return {
      id: col.id,
      type: 'bookmarkGrid',
      order: col.order,
      enabled: col.enabled,
      stack: legacy.folderIds.filter((item): item is string => typeof item === 'string'),
    };
  }

  return {
    id: col.id,
    type: 'bookmarkGrid',
    order: col.order,
    enabled: col.enabled,
    stack: typeof legacy.bookmarkId === 'string' ? [legacy.bookmarkId] : [],
  };
}

/** Ensures required layout fields exist before migration or reconciliation. */
export function coerceLayoutState(raw: unknown): LayoutState {
  const defaults = createDefaultLayoutState();
  if (!isPlainObject(raw)) return defaults;

  const partial = raw as Partial<LayoutState>;
  const hasColumns = Array.isArray(partial.columns);
  const allColumnsObjects =
    hasColumns && (partial.columns as unknown[]).every((entry) => isPlainObject(entry));
  const hasFolderState = isPlainObject(partial.folderState);
  const hasVersion = typeof partial.schemaVersion === 'number' && Number.isFinite(partial.schemaVersion);

  if (hasColumns && allColumnsObjects && hasFolderState && hasVersion) {
    return partial as LayoutState;
  }

  return {
    schemaVersion: hasVersion ? partial.schemaVersion! : defaults.schemaVersion,
    columns: hasColumns
      ? allColumnsObjects
        ? partial.columns!
        : ((partial.columns as unknown[]).filter(isPlainObject) as unknown as ColumnEntry[])
      : [...defaults.columns],
    folderState: hasFolderState ? partial.folderState! : defaults.folderState,
  };
}

/**
 * Repairs layout columns after schema upgrades or partial writes.
 * Converts legacy bookmarkFolder entries and ensures stack is always set.
 */
export function normalizeLayoutColumns(layout: LayoutState): LayoutState {
  let changed = layout.schemaVersion !== SCHEMA_VERSION;

  const mappedColumns: ColumnEntry[] = [];
  for (const col of layout.columns ?? []) {
    if (!isPlainObject(col)) {
      changed = true;
      continue;
    }
    if (isLegacyBookmarkFolderColumn(col)) {
      changed = true;
      mappedColumns.push(legacyBookmarkFolderToGridColumn(col as LegacyBookmarkFolderColumn));
      continue;
    }
    if (col.type === 'bookmarkGrid') {
      const repaired = repairGridColumn(col);
      if (repaired !== col) changed = true;
      mappedColumns.push(repaired);
      continue;
    }
    mappedColumns.push(col);
  }

  const dedupedColumns = dedupeBuiltinWidgetColumns(mappedColumns);
  if (dedupedColumns !== mappedColumns) changed = true;

  if (!changed) return layout;

  return {
    ...layout,
    schemaVersion: SCHEMA_VERSION,
    columns: dedupedColumns,
  };
}

/** Coerce missing fields, then normalize column entries. */
export function sanitizeLayoutState(raw: unknown): LayoutState {
  return normalizeLayoutColumns(coerceLayoutState(raw));
}

export function isLayoutNormalized(layout: LayoutState): boolean {
  if (!isPlainObject(layout)) return false;
  if (layout.schemaVersion !== SCHEMA_VERSION) return false;
  if (!Array.isArray(layout.columns)) return false;
  if (!isPlainObject(layout.folderState)) return false;

  const seenBuiltinWidgets = new Set<string>();
  return layout.columns.every((col) => {
    if (!isPlainObject(col)) return false;
    if (isLegacyBookmarkFolderColumn(col)) return false;
    if (col.type === 'bookmarkGrid') {
      if (!Array.isArray(col.stack)) return false;
      if (!col.stack.every((item) => typeof item === 'string')) return false;
    }
    if (col.type === 'widget' && isTopBarWidget(col.widgetId)) {
      if (seenBuiltinWidgets.has(col.widgetId)) return false;
      seenBuiltinWidgets.add(col.widgetId);
    }
    return true;
  });
}
