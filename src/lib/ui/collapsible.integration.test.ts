import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderCollapsibleStackBlock } from '../render/collapsibleStackBlock';
import { attachCollapsible } from './collapsible';

function buildStackHeaderGrid(): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'bookmarks-grid';

  const column = document.createElement('div');
  column.className = 'column column--bookmark-grid';
  column.dataset.gridColumnId = 'grid:test';

  const body = document.createElement('div');
  body.className = 'bookmark-list';
  const block = renderCollapsibleStackBlock(
    {
      id: 'folder-1',
      title: 'Work',
      collapsed: false,
      headerTitle: 'Drag to reorder',
    },
    body
  );
  column.appendChild(block);
  grid.appendChild(column);
  document.body.appendChild(grid);
  return grid;
}

describe('attachCollapsible integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('uses a focusable button for stack headers', () => {
    buildStackHeaderGrid();
    const header = document.querySelector('.folder-column-header');
    expect(header?.tagName).toBe('BUTTON');
    expect(header?.getAttribute('type')).toBe('button');
    expect(header?.getAttribute('aria-expanded')).toBe('true');
  });

  it('toggles collapse on header click', () => {
    const grid = buildStackHeaderGrid();
    const onCollapsedChange = vi.fn();
    attachCollapsible(grid, {
      expandOnHover: false,
      onCollapsedChange,
    });

    const header = document.querySelector<HTMLButtonElement>('.folder-column-header')!;
    header.click();
    expect(document.querySelector('.folder-column-block')?.classList.contains('is-collapsed')).toBe(
      true
    );
    expect(onCollapsedChange).toHaveBeenCalledWith('folder-1', true);
  });

  it('calls onStackKeyboardMove for Alt+Shift+arrow on a focused header', () => {
    const grid = buildStackHeaderGrid();
    const onStackKeyboardMove = vi.fn();
    attachCollapsible(grid, {
      expandOnHover: false,
      onCollapsedChange: () => {},
      onStackKeyboardMove,
    });

    const header = document.querySelector<HTMLButtonElement>('.folder-column-header')!;
    header.focus();
    header.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, shiftKey: true, bubbles: true })
    );

    expect(onStackKeyboardMove).toHaveBeenCalledWith('folder-1', 'grid:test', 'up');
  });

  it('does not reorder when columns are locked', () => {
    const grid = buildStackHeaderGrid();
    const onStackKeyboardMove = vi.fn();
    attachCollapsible(grid, {
      expandOnHover: false,
      onCollapsedChange: () => {},
      columnsLocked: true,
      onStackKeyboardMove,
    });

    const header = document.querySelector<HTMLButtonElement>('.folder-column-header')!;
    header.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, shiftKey: true, bubbles: true })
    );

    expect(onStackKeyboardMove).not.toHaveBeenCalled();
  });
});
