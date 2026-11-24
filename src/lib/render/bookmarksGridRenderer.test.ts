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

  it('distinguishes a bookmark as a subfolder last child vs next sibling', () => {
    const linkOptions = { openLinksInSameTab: false, rememberOpenFolders: true };
    const bookmarkB = { id: '3', title: 'B', url: 'https://b.example', collapsed: false };
    const bookmarkA = { id: '2', title: 'A', url: 'https://a.example', collapsed: false };

    const insideSubfolder: BookmarkColumnViewModel = {
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
            collapsed: false,
            children: [
              { id: 'sub', title: 'Sub', collapsed: false, children: [bookmarkA, bookmarkB] },
            ],
          },
        },
      ],
    };

    const nextSibling: BookmarkColumnViewModel = {
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
            collapsed: false,
            children: [
              { id: 'sub', title: 'Sub', collapsed: false, children: [bookmarkA] },
              bookmarkB,
            ],
          },
        },
      ],
    };

    expect(bookmarkColumnSignature(insideSubfolder, linkOptions)).not.toBe(
      bookmarkColumnSignature(nextSibling, linkOptions)
    );
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

  it('reports gridDomChanged when unchanged columns are reordered', () => {
    const grid = document.createElement('div');
    const secondMeta: BookmarkGridColumnMeta = {
      id: 'grid:2',
      type: 'bookmarkGrid',
      order: 1,
      enabled: true,
      stack: ['10'],
    };
    const secondVm: BookmarkColumnViewModel = {
      id: 'grid:2',
      order: 1,
      enabled: true,
      stack: [
        {
          kind: 'folder',
          folder: {
            bookmarkId: '10',
            title: 'Personal',
            parentBookmarkId: '0',
            isSyntheticRoot: false,
            collapsed: false,
            children: [],
          },
        },
      ],
    };
    const byId = new Map([
      [columnMeta.id, columnVm],
      [secondMeta.id, secondVm],
    ]);

    const first = refreshBookmarksGrid({
      bookmarksGrid: grid,
      gridColumnMeta: [columnMeta, secondMeta],
      bookmarkColumnsById: byId,
      linkOptions,
      widgetCallbacks: { onSettingsSaved: vi.fn() },
      widgetSlots: new Map(),
      renderEmpty,
    });

    const reordered = refreshBookmarksGrid({
      bookmarksGrid: grid,
      gridColumnMeta: [secondMeta, columnMeta],
      bookmarkColumnsById: byId,
      linkOptions,
      widgetCallbacks: { onSettingsSaved: vi.fn() },
      widgetSlots: first.widgetSlots,
      renderEmpty,
    });

    expect(reordered.gridDomChanged).toBe(true);
    expect(Array.from(grid.children).map((el) => (el as HTMLElement).dataset.columnId)).toEqual([
      'grid:2',
      'grid:1',
    ]);
  });
});
