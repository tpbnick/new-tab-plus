import { describe, expect, it } from 'vitest';
import { gridFolderDropEquals } from './dropTargetEquals';
import type { GridFolderDropResult } from './bookmarkDropTarget';

describe('gridFolderDropEquals', () => {
  it('compares into-column targets by ids and position', () => {
    const a: GridFolderDropResult = {
      mode: 'into',
      gridColumnId: 'grid:1',
      targetFolderId: '10',
      position: 'before',
    };
    const b: GridFolderDropResult = { ...a };
    expect(gridFolderDropEquals(a, b)).toBe(true);
    expect(
      gridFolderDropEquals(a, { ...a, position: 'after' })
    ).toBe(false);
  });
});
