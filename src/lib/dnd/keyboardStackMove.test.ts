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

  it('skips disabled grid columns when moving left or right', () => {
    const withDisabled: BookmarkGridColumnMeta[] = [
      grid('grid:a', 0, ['a']),
      { id: 'grid:special:mostVisited', type: 'bookmarkGrid', order: 1, enabled: false, stack: ['special:mostVisited'] },
      grid('grid:bc', 2, ['b', 'c']),
    ];

    expect(resolveStackKeyboardMove(withDisabled, 'b', 'grid:bc', 'left')).toEqual({
      type: 'move-to-column',
      folderId: 'b',
      sourceGridColumnId: 'grid:bc',
      targetGridColumnId: 'grid:a',
    });

    expect(resolveStackKeyboardMove(withDisabled, 'a', 'grid:a', 'right')).toEqual({
      type: 'move-column',
      folderId: 'a',
      sourceGridColumnId: 'grid:a',
      beforeColumnId: null,
    });
  });
});
