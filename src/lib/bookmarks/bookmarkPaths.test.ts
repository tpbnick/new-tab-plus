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

function bookmark(id: string, title: string, url: string): BookmarkNode {
  return { id, title, url } as BookmarkNode;
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

  it('ignores leaf bookmarks so they do not shift folder disambiguation suffixes', () => {
    const tree = treeWith([
      bookmark('5', 'Work', 'https://work.example'),
      folder('10', 'Work'),
      folder('20', 'Work'),
    ]);

    const { idToPath, pathToId } = buildBookmarkPathMaps(tree);
    expect(idToPath.has('5')).toBe(false);
    expect(idToPath.get('10')).toBe('path:1/Work');
    expect(idToPath.get('20')).toBe('path:1/Work~2');
    expect(pathToId.get('path:1/Work')).toBe('10');
    expect(pathToId.get('path:1/Work~2')).toBe('20');
  });

  it('escapes literal tildes so folder titles like Work~2 do not collide with duplicates', () => {
    const tree = treeWith([
      folder('10', 'Work'),
      folder('20', 'Work'),
      folder('30', 'Work~2'),
    ]);

    const { idToPath, pathToId } = buildBookmarkPathMaps(tree);
    expect(idToPath.get('10')).toBe('path:1/Work');
    expect(idToPath.get('20')).toBe('path:1/Work~2');
    expect(idToPath.get('30')).toBe('path:1/Work%7E2');
    expect(pathToId.get('path:1/Work~2')).toBe('20');
    expect(pathToId.get('path:1/Work%7E2')).toBe('30');
  });

  it('avoids duplicate bookmarkGrid column IDs and dangling grid:path: IDs on restore', () => {
    const target = treeWith([folder('80', 'Work'), folder('90', 'Personal')]);
    const { pathToId } = buildBookmarkPathMaps(target);

    const layout = createDefaultLayoutState();
    layout.columns.push(
      {
        id: 'grid:path:1/Deleted',
        type: 'bookmarkGrid',
        order: 10,
        enabled: true,
        stack: ['path:1/Deleted', 'path:1/Work'],
      },
      {
        id: 'grid:path:1/Work',
        type: 'bookmarkGrid',
        order: 11,
        enabled: true,
        stack: ['path:1/Personal'],
      }
    );

    const restored = layoutFromPortableBookmarks(layout, pathToId, new Set(['80', '90']));
    const gridCols = restored.columns.filter((c) => c.type === 'bookmarkGrid');
    const ids = gridCols.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.includes('path:'))).toBe(false);
  });
});
