import { describe, expect, it } from 'vitest';
import {
  gridColumnIdForFolder,
  insertBeforeIdAfterColumnSplit,
  reIdSourceColumnAfterNamesakeSplit,
} from './gridFolderMove';
import type { BookmarkGridColumnMeta } from '../storage/schema';

function col(id: string, stack: string[]): BookmarkGridColumnMeta {
  return { id, type: 'bookmarkGrid', order: 0, enabled: true, stack };
}

describe('reIdSourceColumnAfterNamesakeSplit', () => {
  it('renames source column when splitting its namesake folder that shared the column', () => {
    const source = col('grid:48', ['48', '24']);
    const taken = new Set(['grid:48']);

    source.stack = ['24'];
    reIdSourceColumnAfterNamesakeSplit(source, '48', taken);

    expect(source.id).toBe('grid:24');
    expect(source.stack).toEqual(['24']);
    expect(taken.has('grid:48')).toBe(false);
    expect(taken.has('grid:24')).toBe(true);
  });

  it('does nothing when source column id does not match split folder', () => {
    const source = col('grid:37', ['37', '48']);
    const taken = new Set(['grid:37']);

    source.stack = ['37'];
    reIdSourceColumnAfterNamesakeSplit(source, '48', taken);

    expect(source.id).toBe('grid:37');
  });

  it('uses stack id when the natural re-id is already taken', () => {
    const source = col('grid:48', ['48', '24']);
    const taken = new Set(['grid:48', 'grid:24']);

    source.stack = ['24'];
    reIdSourceColumnAfterNamesakeSplit(source, '48', taken);

    expect(source.id).toBe('grid:stack:24');
  });
});

describe('insertBeforeIdAfterColumnSplit', () => {
  it('keeps a drop slot that is not the source column', () => {
    expect(insertBeforeIdAfterColumnSplit(['grid:10', 'grid:30'], 'grid:10', 'grid:30', 'grid:20')).toBe(
      'grid:30'
    );
    expect(insertBeforeIdAfterColumnSplit(['grid:10', 'grid:30'], 'grid:10', null, 'grid:20')).toBeNull();
  });

  it('follows a source column that was renamed while splitting its namesake', () => {
    expect(insertBeforeIdAfterColumnSplit(['grid:10', 'grid:30'], 'grid:10', 'grid:10', 'grid:20')).toBe(
      'grid:20'
    );
  });

  it('uses the following column when the source column is removed', () => {
    expect(insertBeforeIdAfterColumnSplit(['grid:5', 'grid:other', 'grid:9'], 'grid:other', 'grid:other', null)).toBe(
      'grid:9'
    );
    expect(insertBeforeIdAfterColumnSplit(['grid:other'], 'grid:other', 'grid:other', null)).toBeNull();
  });
});

describe('gridColumnIdForFolder', () => {
  it('builds grid column ids from folder ids', () => {
    expect(gridColumnIdForFolder('48')).toBe('grid:48');
  });
});
