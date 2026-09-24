import { describe, expect, it } from 'vitest';
import { createDefaultLayoutState } from '../storage/schema';
import {
  buildBookmarkPathMaps,
  layoutFromPortableBookmarks,
  layoutToPortableBookmarks,
} from './bookmarkPaths';

type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;

function folder(id: string, title: string, children: BookmarkNode[] = []): BookmarkNode {
  return { id, title, children } as BookmarkNode;
}

function treeWith(barChildren: BookmarkNode[]): BookmarkNode[] {
  return [folder('0', 'root', [folder('1', 'Bookmarks Bar', barChildren), folder('2', 'Other Bookmarks')])];
}

describe('bookmark path snapshots', () => {
  it('round-trips a column layout onto bookmark ids from another browser', () => {
    const source = treeWith([
      folder('10', 'Work', [folder('11', 'Specs')]),
      folder('20', 'Personal'),
    ]);
    const otherBrowser = treeWith([
      folder('80', 'Work', [folder('81', 'Specs')]),
      folder('90', 'Personal'),
    ]);

    const layout = createDefaultLayoutState();
    layout.columns.push({
      id: 'grid:10',
      type: 'bookmarkGrid',
      order: 10,
      enabled: true,
      stack: ['10', '20'],
    });
    layout.folderState = { '11': { collapsed: true }, '10': { collapsed: false } };

    const portable = layoutToPortableBookmarks(layout, buildBookmarkPathMaps(source).idToPath);
    const restored = layoutFromPortableBookmarks(
      portable,
      buildBookmarkPathMaps(otherBrowser).pathToId,
      new Set(['80', '81', '90'])
    );

    const column = restored.columns.find((col) => col.type === 'bookmarkGrid' && col.stack.includes('80'));
    expect(column?.type === 'bookmarkGrid' ? column.stack : []).toEqual(['80', '90']);
    expect(restored.folderState).toEqual({
      '81': { collapsed: true },
      '80': { collapsed: false },
    });
  });

  it('keeps same-browser ids and drops folders the other browser does not have', () => {
    const source = treeWith([folder('10', 'Work'), folder('20', 'Gone')]);
    const otherBrowser = treeWith([folder('80', 'Work')]);
    const layout = createDefaultLayoutState();
    layout.columns.push({
      id: 'grid:10',
      type: 'bookmarkGrid',
      order: 4,
      enabled: true,
      stack: ['10', '20'],
    });

    const portable = layoutToPortableBookmarks(layout, buildBookmarkPathMaps(source).idToPath);
    const restored = layoutFromPortableBookmarks(
      portable,
      buildBookmarkPathMaps(otherBrowser).pathToId,
      new Set(['80'])
    );

    const column = restored.columns.find((col) => col.type === 'bookmarkGrid' && col.stack.includes('80'));
    expect(column?.type === 'bookmarkGrid' ? column.stack : []).toEqual(['80']);
  });
});
