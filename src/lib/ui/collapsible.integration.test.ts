import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderBookmarkColumn } from '../render/bookmarkColumnRenderer';
import { renderCollapsibleStackBlock } from '../render/collapsibleStackBlock';
import { attachCollapsible, attachNonSelectableLabels } from './collapsible';

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
    vi.stubGlobal('chrome', {
      runtime: { getURL: (path: string) => `chrome-extension://test${path}` },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('handles selectstart and mousedown dispatched on a Text node inside a header', () => {
    const grid = buildStackHeaderGrid();
    const dispose = attachNonSelectableLabels(grid);

    const label = grid.querySelector('.folder-header-label')!;
    const textNode = label.firstChild!;
    expect(textNode.nodeType).toBe(Node.TEXT_NODE);

    const selectEvent = new Event('selectstart', { bubbles: true, cancelable: true });
    expect(() => textNode.dispatchEvent(selectEvent)).not.toThrow();
    expect(selectEvent.defaultPrevented).toBe(true);

    const dblMouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      detail: 2,
    });
    expect(() => textNode.dispatchEvent(dblMouseDown)).not.toThrow();
    expect(dblMouseDown.defaultPrevented).toBe(true);

    dispose();
  });

  it('sets and toggles inert on collapsed folder bodies and during hover-peek', () => {
    const grid = buildStackHeaderGrid();
    attachCollapsible(grid, {
      expandOnHover: true,
      onCollapsedChange: () => {},
    });

    const block = grid.querySelector<HTMLElement>('.folder-column-block')!;
    const header = block.querySelector<HTMLButtonElement>('.folder-column-header')!;
    const body = block.querySelector<HTMLElement>('.folder-column-body')!;

    expect(body.hasAttribute('inert')).toBe(false);

    // Click to collapse -> inert added
    header.click();
    expect(body.hasAttribute('inert')).toBe(true);

    // Hover peek -> inert removed while hover-expanded
    block.dispatchEvent(new MouseEvent('mouseenter'));
    expect(block.classList.contains('is-hover-expanded')).toBe(true);
    expect(body.hasAttribute('inert')).toBe(false);

    // Hover leave -> inert restored while still collapsed
    block.dispatchEvent(new MouseEvent('mouseleave'));
    expect(block.classList.contains('is-hover-expanded')).toBe(false);
    expect(body.hasAttribute('inert')).toBe(true);

    // Click to expand -> inert removed
    header.click();
    expect(body.hasAttribute('inert')).toBe(false);
  });

  it('renders collapsed stack blocks and nested folders with inert bodies', () => {
    const col = renderBookmarkColumn(
      {
        id: 'grid:1',
        order: 0,
        enabled: true,
        stack: [
          {
            kind: 'folder',
            folder: {
              bookmarkId: '1',
              title: 'Root',
              parentBookmarkId: '0',
              isSyntheticRoot: false,
              collapsed: true,
              children: [
                {
                  id: '2',
                  title: 'Nested',
                  collapsed: true,
                  children: [{ id: '3', title: 'Link', url: 'https://example.com', collapsed: false }],
                },
              ],
            },
          },
        ],
      },
      { openLinksInSameTab: false, rememberOpenFolders: true }
    );

    const outerBody = col.querySelector<HTMLElement>('.folder-column-body')!;
    const innerBody = col.querySelector<HTMLElement>('.folder-item-body')!;
    expect(outerBody.hasAttribute('inert')).toBe(true);
    expect(innerBody.hasAttribute('inert')).toBe(true);

    // Expanding outer folder only clears outer inert, keeping nested collapsed folder inert
    document.body.appendChild(col);
    attachCollapsible(col, { expandOnHover: false, onCollapsedChange: () => {} });
    col.querySelector<HTMLButtonElement>('.folder-column-header')!.click();
    expect(outerBody.hasAttribute('inert')).toBe(false);
    expect(innerBody.hasAttribute('inert')).toBe(true);

    // Static nested folders (rememberOpenFolders: false) are never inert
    const staticCol = renderBookmarkColumn(
      {
        id: 'grid:2',
        order: 0,
        enabled: true,
        stack: [
          {
            kind: 'folder',
            folder: {
              bookmarkId: '1',
              title: 'Root',
              parentBookmarkId: '0',
              isSyntheticRoot: false,
              collapsed: false,
              children: [
                {
                  id: '2',
                  title: 'StaticNested',
                  collapsed: true,
                  children: [{ id: '3', title: 'Link', url: 'https://example.com', collapsed: false }],
                },
              ],
            },
          },
        ],
      },
      { openLinksInSameTab: false, rememberOpenFolders: false }
    );
    expect(staticCol.querySelector<HTMLElement>('.folder-item-body')!.hasAttribute('inert')).toBe(
      false
    );
  });
});
