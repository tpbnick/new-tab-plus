import { gridColumnIdForStackItem } from '../grid/gridStack';
import type { BookmarkGridColumnMeta, LayoutState, SpecialSectionMeta } from './schema';
import {
  isLegacyBookmarkFolderColumn,
  legacyBookmarkFolderToGridColumn,
} from './legacyLayoutColumn';

type ColumnEntry = LayoutState['columns'][number];

type Migration = (old: unknown) => unknown;

/** v1 → v2: one bookmark folder per column becomes a grid column with a stack array. */
function migrateLayoutV1ToV2(raw: unknown): LayoutState {
  const layout = raw as Omit<LayoutState, 'columns'> & { columns?: unknown };
  if (!Array.isArray(layout.columns)) {
    return {
      ...(layout as LayoutState),
      schemaVersion: 2,
    };
  }
  return {
    ...(layout as LayoutState),
    schemaVersion: 2,
    columns: layout.columns.flatMap((col): ColumnEntry[] => {
      if (!col || typeof col !== 'object' || Array.isArray(col)) return [];
      if (!isLegacyBookmarkFolderColumn(col)) return [col as ColumnEntry];
      return [legacyBookmarkFolderToGridColumn(col)];
    }),
  };
}

/** v2 → v3: special sections become stack entries inside bookmark grid columns. */
function migrateLayoutV2ToV3(raw: unknown): LayoutState {
  const layout = raw as Omit<LayoutState, 'columns'> & { columns?: unknown };
  if (!Array.isArray(layout.columns)) {
    return {
      ...(layout as LayoutState),
      schemaVersion: 3,
    };
  }
  const specialSections: SpecialSectionMeta[] = [];
  const gridColumns: BookmarkGridColumnMeta[] = [];
  const otherColumns: ColumnEntry[] = [];

  for (const col of layout.columns) {
    if (!col || typeof col !== 'object' || Array.isArray(col)) continue;
    const entry = col as ColumnEntry;
    if (entry.type === 'specialSection') {
      specialSections.push(entry);
      gridColumns.push({
        id: gridColumnIdForStackItem(entry.id),
        type: 'bookmarkGrid',
        order: entry.order,
        enabled: entry.enabled,
        stack: [entry.id],
      });
      continue;
    }
    if (entry.type === 'bookmarkGrid') {
      const legacy = entry as BookmarkGridColumnMeta & { folderIds?: string[] };
      gridColumns.push({
        id: entry.id,
        type: 'bookmarkGrid',
        order: entry.order,
        enabled: entry.enabled,
        stack: entry.stack ?? legacy.folderIds ?? [],
      });
      continue;
    }
    otherColumns.push(entry);
  }

  return {
    ...(layout as LayoutState),
    schemaVersion: 3,
    columns: [...gridColumns, ...specialSections, ...otherColumns].sort((a, b) => a.order - b.order),
  };
}

const migrations: Record<number, Migration> = {
  1: migrateLayoutV1ToV2,
  2: migrateLayoutV2ToV3,
};

export function runMigrations(raw: unknown, targetVersion: number): unknown {
  let payload = raw;
  let version = readVersion(payload);

  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) {
      break;
    }
    payload = migrate(payload);
    version = readVersion(payload);
  }

  return payload;
}

function readVersion(payload: unknown): number {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'schemaVersion' in payload &&
    typeof (payload as { schemaVersion: unknown }).schemaVersion === 'number'
  ) {
    return (payload as { schemaVersion: number }).schemaVersion;
  }
  return 0;
}
