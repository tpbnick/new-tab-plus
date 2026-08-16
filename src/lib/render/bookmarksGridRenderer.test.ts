import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookmarkColumnSignature, refreshBookmarksGrid } from './bookmarksGridRenderer';
import type { BookmarkColumnViewModel } from '../types';
import type { BookmarkGridColumnMeta } from '../storage/schema';

describe('bookmarkColumnSignature', () => {
  it('changes when bookmark title changes', () => {
    const linkOptions = {
      openLinksInSameTab: false,
      rememberOpenFolders: true,
    };
    const before: BookmarkColumnViewModel = {
      id: 'grid:1',
      order: 0,
      enabled: true,
      stack: [
        {
          kind: 'folder',
          folder: {
            bookmarkId: '1',
            title: 'Work',
            parentBookmarkId: '0',
            isSyntheticRoot: false,
            collapsed: false,
            children: [{ id: '2', title: 'Docs', url: 'https://example.com', collapsed: false }],
          },
        },
      ],
    };
    const folderEntry = before.stack[0]!;
    if (folderEntry.kind !== 'folder') throw new Error('expected folder');
    const after: BookmarkColumnViewModel = {
      ...before,
      stack: [
        {
          kind: 'folder',
          folder: {
            ...folderEntry.folder,
            children: [{ id: '2', title: 'Documents', url: 'https://example.com', collapsed: false }],
          },
        },
      ],
    };

    expect(bookmarkColumnSignature(before, linkOptions)).not.toBe(
      bookmarkColumnSignature(after, linkOptions)
    );
  });

  it('is stable when view model is unchanged', () => {
    const vm: BookmarkColumnViewModel = {
      id: 'grid:1',
      order: 0,
      enabled: true,
      stack: [],
    };
    const linkOptions = { openLinksInSameTab: true, rememberOpenFolders: false };
    expect(bookmarkColumnSignature(vm, linkOptions)).toBe(bookmarkColumnSignature(vm, linkOptions));
  });
});

describe('refreshBookmarksGrid', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: { getURL: (path: string) => `chrome-extension://test${path}` },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const columnVm: BookmarkColumnViewModel = {
    id: 'grid:1',
    order: 0,
    enabled: true,
    stack: [
      {
        kind: 'folder',
        folder: {
          bookmarkId: '1',
          title: 'Work',
          parentBookmarkId: '0',
          isSyntheticRoot: false,
          collapsed: false,
          children: [{ id: '2', title: 'Docs', url: 'https://example.com', collapsed: false }],
        },
      },
    ],
  };
  const columnMeta: BookmarkGridColumnMeta = {
    id: 'grid:1',
    type: 'bookmarkGrid',
    order: 0,
    enabled: true,
    stack: ['1'],
  };
  const linkOptions = { openLinksInSameTab: false, rememberOpenFolders: true, lockColumns: false };

  function renderEmpty(): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'bookmarks-grid-empty';
    return empty;
  }

  it('keeps reused columns in the document instead of detaching them', () => {
    const grid = document.createElement('div');
    document.body.appendChild(grid);
    const first = refreshBookmarksGrid({
      bookmarksGrid: grid,
      gridColumnMeta: [columnMeta],
      bookmarkColumnsById: new Map([[columnMeta.id, columnVm]]),
      linkOptions,
      widgetCallbacks: { onSettingsSaved: vi.fn() },
      widgetSlots: new Map(),
      renderEmpty,
    });
    const column = grid.querySelector<HTMLElement>('.column[data-column-id="grid:1"]');
    expect(column?.isConnected).toBe(true);

    const second = refreshBookmarksGrid({
      bookmarksGrid: grid,
      gridColumnMeta: [columnMeta],
      bookmarkColumnsById: new Map([[columnMeta.id, columnVm]]),
      linkOptions,
      widgetCallbacks: { onSettingsSaved: vi.fn() },
      widgetSlots: first.widgetSlots,
      renderEmpty,
    });
    expect(grid.querySelector('.column[data-column-id="grid:1"]')).toBe(column);
    expect(column?.isConnected).toBe(true);
    expect(second.gridDomChanged).toBe(false);
  });

  it('does not replace an empty grid that is already showing the empty state', () => {
    const grid = document.createElement('div');
    const first = refreshBookmarksGrid({
      bookmarksGrid: grid,
      gridColumnMeta: [],
      bookmarkColumnsById: new Map(),
      linkOptions,
      widgetCallbacks: { onSettingsSaved: vi.fn() },
      widgetSlots: new Map(),
      renderEmpty,
    });
    const empty = grid.firstElementChild;
    expect(first.gridDomChanged).toBe(true);
    expect(empty?.classList.contains('bookmarks-grid-empty')).toBe(true);

    const second = refreshBookmarksGrid({
      bookmarksGrid: grid,
      gridColumnMeta: [],
      bookmarkColumnsById: new Map(),
      linkOptions,
      widgetCallbacks: { onSettingsSaved: vi.fn() },
      widgetSlots: new Map(),
      renderEmpty,
    });
    expect(second.gridDomChanged).toBe(false);
    expect(grid.firstElementChild).toBe(empty);
  });
});
