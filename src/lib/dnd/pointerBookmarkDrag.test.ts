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
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        bubbles: true,
      })
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
    grid.getBoundingClientRect = () => rect(0, 700, 0, 400);
    const onGridFolderDrop = vi.fn();
    const detach = attachPointerFolderDrag(grid, { onGridFolderDrop });

    headerA.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        bubbles: true,
      })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 50,
        pointerId: 1,
        bubbles: true,
      })
    );
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));

    expect(headerB).toBeTruthy();
    expect(onGridFolderDrop).toHaveBeenCalledTimes(1);
    expect(consumeHeaderClickSuppression()).toBe(true);
    expect(consumeHeaderClickSuppression()).toBe(false);

    detach();
  });

  it('suppresses the next header click even when dropped outside a valid target', () => {
    const { grid, headerA } = makeDragGrid();
    grid.getBoundingClientRect = () => rect(0, 700, 0, 400);
    const onGridFolderDrop = vi.fn();
    const detach = attachPointerFolderDrag(grid, { onGridFolderDrop });

    headerA.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 10,
        clientY: 10,
        pointerId: 2,
        bubbles: true,
      })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 900,
        pointerId: 2,
        bubbles: true,
      })
    );
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, bubbles: true }));

    expect(onGridFolderDrop).not.toHaveBeenCalled();
    expect(consumeHeaderClickSuppression()).toBe(true);
    expect(consumeHeaderClickSuppression()).toBe(false);
    detach();
  });

  it('cleans up on pointercancel without committing a drop or suppressing the next click', () => {
    const { grid, headerA } = makeDragGrid();
    grid.getBoundingClientRect = () => rect(0, 700, 0, 400);
    const onGridFolderDrop = vi.fn();
    const detach = attachPointerFolderDrag(grid, { onGridFolderDrop });

    headerA.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 10,
        clientY: 10,
        pointerId: 3,
        bubbles: true,
      })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 50,
        pointerId: 3,
        bubbles: true,
      })
    );
    expect(document.body.classList.contains('is-folder-dragging')).toBe(true);

    document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 3, bubbles: true }));

    expect(document.body.classList.contains('is-folder-dragging')).toBe(false);
    expect(onGridFolderDrop).not.toHaveBeenCalled();
    expect(consumeHeaderClickSuppression()).toBe(false);
    detach();
  });

  it('ignores events from secondary pointers while a drag gesture is active', () => {
    const { grid, headerA, headerB } = makeDragGrid();
    grid.getBoundingClientRect = () => rect(0, 700, 0, 400);
    const onGridFolderDrop = vi.fn();
    const detach = attachPointerFolderDrag(grid, { onGridFolderDrop });

    headerA.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 10,
        clientY: 10,
        pointerId: 10,
        bubbles: true,
      })
    );
    // Secondary pointerdown is ignored
    headerB.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 260,
        clientY: 10,
        pointerId: 11,
        bubbles: true,
      })
    );
    // Secondary pointermove is ignored
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 50,
        pointerId: 11,
        bubbles: true,
      })
    );
    expect(document.body.classList.contains('is-folder-dragging')).toBe(false);

    // Primary pointer activates drag
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 50,
        pointerId: 10,
        bubbles: true,
      })
    );
    expect(document.body.classList.contains('is-folder-dragging')).toBe(true);

    // Secondary pointerup / pointercancel does not terminate primary drag
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 11, bubbles: true }));
    expect(document.body.classList.contains('is-folder-dragging')).toBe(true);
    expect(onGridFolderDrop).not.toHaveBeenCalled();

    // Primary pointerup completes the drop for headerA ('a')
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 10, bubbles: true }));
    expect(onGridFolderDrop).toHaveBeenCalledWith('a', 'grid:a', expect.anything());
    consumeHeaderClickSuppression();
    detach();
  });

  it('recovers cleanly when setPointerCapture throws on a detached header', () => {
    const { grid, headerA } = makeDragGrid();
    headerA.setPointerCapture = vi.fn(() => {
      throw new DOMException('detached', 'InvalidStateError');
    });
    const detach = attachPointerFolderDrag(grid, { onGridFolderDrop: vi.fn() });

    headerA.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 10,
        clientY: 10,
        pointerId: 4,
        bubbles: true,
      })
    );
    expect(() =>
      document.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 10 + FOLDER_DRAG_THRESHOLD_PX + 4,
          clientY: 10,
          pointerId: 4,
          bubbles: true,
        })
      )
    ).not.toThrow();

    expect(document.body.classList.contains('is-folder-dragging')).toBe(true);
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, bubbles: true }));
    expect(document.body.classList.contains('is-folder-dragging')).toBe(false);
    consumeHeaderClickSuppression();
    detach();
  });
});
