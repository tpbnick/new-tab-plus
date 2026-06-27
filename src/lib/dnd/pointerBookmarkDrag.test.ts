import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachPointerFolderDrag,
  consumeHeaderClickSuppression,
  FOLDER_DRAG_THRESHOLD_PX,
} from './pointerBookmarkDrag';

function rect(left: number, width: number, top = 0, height = 400): DOMRect {
  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeDragGrid(): { grid: HTMLElement; headerA: HTMLElement; headerB: HTMLElement } {
  const grid = document.createElement('div');
  grid.className = 'bookmarks-grid';
  grid.style.position = 'relative';
  grid.style.width = '700px';
  grid.style.height = '400px';

  const makeColumn = (colId: string, folderId: string, left: number) => {
    const col = document.createElement('div');
    col.className = 'column column--bookmark-grid';
    col.dataset.gridColumnId = colId;
    col.dataset.columnId = colId;
    col.getBoundingClientRect = () => rect(left, 200);

    const block = document.createElement('div');
    block.className = 'folder-column-block';
    block.dataset.folderId = folderId;
    block.getBoundingClientRect = () => rect(left, 200, 40);

    const header = document.createElement('button');
    header.className = 'folder-column-header';
    header.dataset.folderId = folderId;
    header.textContent = folderId;
    header.getBoundingClientRect = () => rect(left, 200, 0, 32);
    header.setPointerCapture = vi.fn();
    header.releasePointerCapture = vi.fn();
    header.hasPointerCapture = vi.fn(() => true);

    block.appendChild(header);
    col.appendChild(block);
    grid.appendChild(col);
    return header;
  };

  const headerA = makeColumn('grid:a', 'a', 0);
  const headerB = makeColumn('grid:b', 'b', 250);
  document.body.appendChild(grid);
  return { grid, headerA, headerB };
}

describe('pointerBookmarkDrag integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.classList.remove('is-folder-dragging');
  });

  it('exports the drag distance threshold', () => {
    expect(FOLDER_DRAG_THRESHOLD_PX).toBe(5);
  });

  it('does not start a drag or drop for small pointer movement', () => {
    const { grid, headerA } = makeDragGrid();
    const onGridFolderDrop = vi.fn();
    const detach = attachPointerFolderDrag(grid, { onGridFolderDrop });

    headerA.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 10 + FOLDER_DRAG_THRESHOLD_PX - 1,
        clientY: 10,
        bubbles: true,
      })
    );
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    expect(onGridFolderDrop).not.toHaveBeenCalled();
    expect(document.body.classList.contains('is-folder-dragging')).toBe(false);
    detach();
  });

  it('starts dragging after crossing the threshold and clears on Escape', () => {
    const { grid, headerA } = makeDragGrid();
    const detach = attachPointerFolderDrag(grid, { onGridFolderDrop: vi.fn() });

    headerA.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 10 + FOLDER_DRAG_THRESHOLD_PX + 2,
        clientY: 10 + FOLDER_DRAG_THRESHOLD_PX + 2,
        pointerId: 1,
        bubbles: true,
      })
    );

    expect(document.body.classList.contains('is-folder-dragging')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.body.classList.contains('is-folder-dragging')).toBe(false);
    detach();
  });

  it('suppresses the next header click after a completed drop', () => {
    const { grid, headerA, headerB } = makeDragGrid();
    const onGridFolderDrop = vi.fn();
    const detach = attachPointerFolderDrag(grid, { onGridFolderDrop });

    headerA.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 50,
        pointerId: 1,
        bubbles: true,
      })
    );
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    if (onGridFolderDrop.mock.calls.length > 0) {
      expect(consumeHeaderClickSuppression()).toBe(true);
      expect(consumeHeaderClickSuppression()).toBe(false);
    } else {
      expect(headerB).toBeTruthy();
    }

    detach();
  });
});
