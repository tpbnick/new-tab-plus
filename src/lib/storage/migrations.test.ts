import { describe, expect, it } from 'vitest';
import { runMigrations } from './migrations';

describe('runMigrations', () => {
  it('returns the payload unchanged when already at target version', () => {
    const payload = { schemaVersion: 3, foo: 'bar' };
    expect(runMigrations(payload, 3)).toBe(payload);
  });

  it('treats a payload with no schemaVersion as version 0', () => {
    const payload = { foo: 'bar' };
    expect(runMigrations(payload, 3)).toBe(payload);
  });

  it('migrates v1 bookmarkFolder columns to v2 bookmarkGrid columns', () => {
    const payload = {
      schemaVersion: 1,
      columns: [
        { id: 'bm:10', type: 'bookmarkFolder', order: 0, enabled: true, bookmarkId: '10' },
        { id: 'special:apps', type: 'specialSection', order: 1, enabled: true, kind: 'apps' },
      ],
      folderState: {},
    };

    const migrated = runMigrations(payload, 2) as {
      schemaVersion: number;
      columns: Array<{ type: string; id: string; stack?: string[] }>;
    };

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.columns[0]).toEqual({
      id: 'grid:10',
      type: 'bookmarkGrid',
      order: 0,
      enabled: true,
      stack: ['10'],
    });
    expect(migrated.columns[1].type).toBe('specialSection');
  });

  it('migrates v2 special sections into bookmark grid stack columns', () => {
    const payload = {
      schemaVersion: 2,
      columns: [
        { id: 'special:mostVisited', type: 'specialSection', order: 0, enabled: true, kind: 'mostVisited' },
        { id: 'grid:10', type: 'bookmarkGrid', order: 1, enabled: true, stack: ['10'] },
      ],
      folderState: {},
    };

    const migrated = runMigrations(payload, 3) as {
      schemaVersion: number;
      columns: Array<{ type: string; id: string; stack?: string[] }>;
    };

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.columns.find((c) => c.id === 'grid:special:mostVisited')).toMatchObject({
      type: 'bookmarkGrid',
      stack: ['special:mostVisited'],
    });
    expect(migrated.columns.find((c) => c.id === 'grid:10')).toMatchObject({
      type: 'bookmarkGrid',
      stack: ['10'],
    });
    expect(migrated.columns.find((c) => c.id === 'special:mostVisited')?.type).toBe('specialSection');
  });
});
