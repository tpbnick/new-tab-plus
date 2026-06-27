import { dedupeBuiltinWidgetColumns } from '../widgets/widgetLayout';
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

function repairGridColumn(col: BookmarkGridColumnMeta): BookmarkGridColumnMeta {
  if (Array.isArray(col.stack)) return col;

  const legacy = col as BookmarkGridColumnMeta & { folderIds?: string[]; bookmarkId?: string };
  if (Array.isArray(legacy.folderIds)) {
    return { id: col.id, type: 'bookmarkGrid', order: col.order, enabled: col.enabled, stack: legacy.folderIds };
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
  if (!raw || typeof raw !== 'object') return defaults;

  const partial = raw as Partial<LayoutState>;
  const hasColumns = Array.isArray(partial.columns);
  const hasFolderState = partial.folderState && typeof partial.folderState === 'object';
  const hasVersion = typeof partial.schemaVersion === 'number';

  if (hasColumns && hasFolderState && hasVersion) {
    return partial as LayoutState;
  }

  return {
    schemaVersion: hasVersion ? partial.schemaVersion! : defaults.schemaVersion,
    columns: hasColumns ? partial.columns! : [...defaults.columns],
    folderState: hasFolderState ? partial.folderState! : defaults.folderState,
  };
}

/**
 * Repairs layout columns after schema upgrades or partial writes.
 * Converts legacy bookmarkFolder entries and ensures stack is always set.
 */
export function normalizeLayoutColumns(layout: LayoutState): LayoutState {
  let changed = false;

  const columns = dedupeBuiltinWidgetColumns(
    (layout.columns ?? []).map((col): ColumnEntry => {
      if (isLegacyBookmarkFolderColumn(col)) {
        changed = true;
        return legacyBookmarkFolderToGridColumn(col as LegacyBookmarkFolderColumn);
      }
      if (col.type === 'bookmarkGrid') {
        const repaired = repairGridColumn(col);
        if (repaired !== col) changed = true;
        return repaired;
      }
      return col;
    })
  );

  if (columns.length !== (layout.columns ?? []).length) changed = true;

  if (!changed) return layout;

  return {
    ...layout,
    schemaVersion: Math.max(layout.schemaVersion ?? 0, SCHEMA_VERSION),
    columns,
  };
}

/** Coerce missing fields, then normalize column entries. */
export function sanitizeLayoutState(raw: unknown): LayoutState {
  return normalizeLayoutColumns(coerceLayoutState(raw));
}

export function isLayoutNormalized(layout: LayoutState): boolean {
  return (layout.columns ?? []).every((col) => {
    if (isLegacyBookmarkFolderColumn(col)) return false;
    if (col.type === 'bookmarkGrid' && !Array.isArray(col.stack)) return false;
    return true;
  });
}
