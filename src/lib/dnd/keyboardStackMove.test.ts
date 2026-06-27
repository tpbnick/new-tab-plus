import { describe, expect, it } from 'vitest';
import type { BookmarkGridColumnMeta } from '../storage/schema';
import { resolveStackKeyboardMove } from './keyboardStackMove';

function grid(id: string, order: number, stack: string[]): BookmarkGridColumnMeta {
  return { id, type: 'bookmarkGrid', order, enabled: true, stack };
}

describe('resolveStackKeyboardMove', () => {
  const columns = [
    grid('grid:a', 0, ['a']),
    grid('grid:bc', 1, ['b', 'c']),
    grid('grid:d', 2, ['d']),
  ];

  it('moves a block up within its column', () => {
    expect(resolveStackKeyboardMove(columns, 'c', 'grid:bc', 'up')).toEqual({
      type: 'reorder-in-column',
      gridColumnId: 'grid:bc',
      folderId: 'c',
      beforeFolderId: 'b',
    });
  });

  it('moves a solo column left', () => {
    expect(resolveStackKeyboardMove(columns, 'd', 'grid:d', 'left')).toEqual({
      type: 'move-column',
      folderId: 'd',
      sourceGridColumnId: 'grid:d',
      beforeColumnId: 'grid:bc',
    });
  });

  it('moves a stacked block to the adjacent column', () => {
    expect(resolveStackKeyboardMove(columns, 'c', 'grid:bc', 'right')).toEqual({
      type: 'move-to-column',
      folderId: 'c',
      sourceGridColumnId: 'grid:bc',
      targetGridColumnId: 'grid:d',
    });
  });

  it('returns noop at edges', () => {
    expect(resolveStackKeyboardMove(columns, 'a', 'grid:a', 'left')).toEqual({ type: 'noop' });
    expect(resolveStackKeyboardMove(columns, 'b', 'grid:bc', 'up')).toEqual({ type: 'noop' });
  });
});
