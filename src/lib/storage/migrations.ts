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
  const layout = raw as Omit<LayoutState, 'columns'> & { columns: unknown[] };
  return {
    ...layout,
    schemaVersion: 2,
    columns: (layout.columns ?? []).map((col) => {
      if (!isLegacyBookmarkFolderColumn(col)) return col as ColumnEntry;
      return legacyBookmarkFolderToGridColumn(col);
    }),
  };
}

/** v2 → v3: special sections become stack entries inside bookmark grid columns. */
function migrateLayoutV2ToV3(raw: unknown): LayoutState {
  const layout = raw as LayoutState;
  const specialSections: SpecialSectionMeta[] = [];
  const gridColumns: BookmarkGridColumnMeta[] = [];
  const otherColumns: ColumnEntry[] = [];

  for (const col of layout.columns ?? []) {
    if (col.type === 'specialSection') {
      specialSections.push(col);
      gridColumns.push({
        id: gridColumnIdForStackItem(col.id),
        type: 'bookmarkGrid',
        order: col.order,
        enabled: col.enabled,
        stack: [col.id],
      });
      continue;
    }
    if (col.type === 'bookmarkGrid') {
      const legacy = col as BookmarkGridColumnMeta & { folderIds?: string[] };
      gridColumns.push({
        id: col.id,
        type: 'bookmarkGrid',
        order: col.order,
        enabled: col.enabled,
        stack: col.stack ?? legacy.folderIds ?? [],
      });
      continue;
    }
    otherColumns.push(col);
  }

  return {
    ...layout,
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
