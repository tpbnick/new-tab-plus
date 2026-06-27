import { describe, expect, it } from 'vitest';
import { reconcileBookmarkColumns, resetBookmarkGridLayout } from './bookmarkTree';
import { createDefaultLayoutState } from '../storage/schema';
import type { LayoutState } from '../storage/schema';
import type { BookmarkColumnViewModel, BookmarkFolderViewModel } from '../types';

type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;

function folder(id: string, title: string, children: BookmarkNode[]): BookmarkNode {
  return { id, title, children } as BookmarkNode;
}

function bookmark(id: string, title: string, url: string): BookmarkNode {
  return { id, title, url } as BookmarkNode;
}

function buildTree(barChildren: BookmarkNode[], otherChildren: BookmarkNode[] = []): BookmarkNode[] {
  return [
    folder('0', 'root', [
      folder('1', 'Bookmarks Bar', barChildren),
      folder('2', 'Other Bookmarks', otherChildren),
    ]),
  ];
}

function stackFolders(column: BookmarkColumnViewModel): BookmarkFolderViewModel[] {
  return column.stack
    .filter((entry): entry is { kind: 'folder'; folder: BookmarkFolderViewModel } => entry.kind === 'folder')
    .map((entry) => entry.folder);
}

describe('reconcileBookmarkColumns', () => {
  it('turns top-level folders into grid columns with nested children preserved', () => {
    const tree = buildTree([
      folder('10', 'Work', [bookmark('11', 'Jira', 'https://jira.example')]),
      folder('20', 'Personal', [
        bookmark('21', 'Mail', 'https://mail.example'),
        folder('22', 'Recipes', [bookmark('23', 'Soup', 'https://soup.example')]),
      ]),
    ]);

    const { columns, layout } = reconcileBookmarkColumns(tree, {
      ...createDefaultLayoutState(),
      columns: [],
    });

    expect(columns).toHaveLength(2);
    expect(stackFolders(columns[0])).toHaveLength(1);
    expect(stackFolders(columns[0])[0].bookmarkId).toBe('10');
    expect(stackFolders(columns[0])[0].title).toBe('Work');
    expect(stackFolders(columns[0])[0].children).toEqual([
      { id: '11', title: 'Jira', url: 'https://jira.example', collapsed: false },
    ]);

    expect(stackFolders(columns[1])[0].bookmarkId).toBe('20');
    expect(stackFolders(columns[1])[0].children[1]).toMatchObject({ id: '22', title: 'Recipes', collapsed: false });
    expect((stackFolders(columns[1])[0].children[1].children ?? [])[0]).toEqual({
      id: '23',
      title: 'Soup',
      url: 'https://soup.example',
      collapsed: false,
    });

    expect(layout.columns.filter((c) => c.type === 'bookmarkGrid')).toHaveLength(2);
  });

  it('groups loose top-level bookmarks into a synthetic root column', () => {
    const tree = buildTree([bookmark('30', 'Loose Link', 'https://example.com')]);

    const { columns } = reconcileBookmarkColumns(tree, {
      ...createDefaultLayoutState(),
      columns: [],
    });

    const bookmarkColumns = columns.filter((c) => c.stack.some((e) => e.kind === 'folder'));
    expect(bookmarkColumns).toHaveLength(1);
    expect(stackFolders(bookmarkColumns[0])[0].bookmarkId).toBe('1');
    expect(stackFolders(bookmarkColumns[0])[0].title).toBe('Bookmarks Bar');
    expect(stackFolders(bookmarkColumns[0])[0].isSyntheticRoot).toBe(true);
    expect(stackFolders(bookmarkColumns[0])[0].children).toEqual([
      { id: '30', title: 'Loose Link', url: 'https://example.com', collapsed: false },
    ]);
  });

  it('returns the same layout reference when nothing changed, to avoid redundant storage writes', () => {
    const tree = buildTree([folder('10', 'Work', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [
        ...createDefaultLayoutState().columns,
        { id: 'grid:10', type: 'bookmarkGrid', order: 2000, enabled: true, stack: ['10'] },
      ],
    };

    const { layout: reconciled } = reconcileBookmarkColumns(tree, layout);
    expect(reconciled).toBe(layout);
  });

  it('returns the same layout reference when grid columns are stored out of order', () => {
    const tree = buildTree([folder('10', 'Work', []), folder('20', 'Personal', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [
        { id: 'grid:20', type: 'bookmarkGrid', order: 1, enabled: true, stack: ['20'] },
        { id: 'grid:10', type: 'bookmarkGrid', order: 0, enabled: true, stack: ['10'] },
      ],
    };

    const { layout: reconciled } = reconcileBookmarkColumns(tree, layout);
    expect(reconciled).toBe(layout);
  });

  it('drops grid columns for folders that no longer exist in the tree', () => {
    const tree = buildTree([folder('10', 'Work', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [
        { id: 'grid:10', type: 'bookmarkGrid', order: 0, enabled: true, stack: ['10'] },
        { id: 'grid:99', type: 'bookmarkGrid', order: 1, enabled: true, stack: ['99'] },
      ],
    };

    const { columns, layout: reconciled } = reconcileBookmarkColumns(tree, layout);

    expect(columns).toHaveLength(1);
    expect(stackFolders(columns[0])[0].bookmarkId).toBe('10');
    expect(reconciled.columns.find((c) => c.id === 'grid:99')).toBeUndefined();
  });

  it('appends new top-level folders as new grid columns', () => {
    const tree = buildTree([folder('10', 'Work', []), folder('20', 'Personal', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [{ id: 'grid:20', type: 'bookmarkGrid', order: 0, enabled: true, stack: ['20'] }],
    };

    const { columns } = reconcileBookmarkColumns(tree, layout);

    expect(columns.map((c) => stackFolders(c).map((f) => f.bookmarkId))).toEqual([['20'], ['10']]);
  });

  it('passes through non-bookmark columns (special sections, widgets) untouched', () => {
    const tree = buildTree([folder('10', 'Work', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [
        ...createDefaultLayoutState().columns,
        { id: 'grid:10', type: 'bookmarkGrid', order: 2000, enabled: true, stack: ['10'] },
      ],
    };

    const { layout: reconciled } = reconcileBookmarkColumns(tree, layout);
    expect(reconciled.columns.find((c) => c.id === 'special:mostVisited')).toBeDefined();
    expect(reconciled.columns.find((c) => c.id === 'grid:10')).toBeDefined();
  });

  it('applies folder collapsed state from layout', () => {
    const tree = buildTree([folder('10', 'Work', [folder('11', 'Nested', [])])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [{ id: 'grid:10', type: 'bookmarkGrid', order: 0, enabled: true, stack: ['10'] }],
      folderState: { '11': { collapsed: true } },
    };

    const { columns } = reconcileBookmarkColumns(tree, layout);

    expect(stackFolders(columns[0])[0].children[0].collapsed).toBe(true);
  });

  it('preserves multiple folders assigned to the same grid column', () => {
    const tree = buildTree([folder('10', 'Work', []), folder('20', 'Personal', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [
        { id: 'grid:combined', type: 'bookmarkGrid', order: 0, enabled: true, stack: ['10', '20'] },
      ],
    };

    const { columns } = reconcileBookmarkColumns(tree, layout);

    expect(columns).toHaveLength(1);
    expect(stackFolders(columns[0]).map((f) => f.bookmarkId)).toEqual(['10', '20']);
  });

  it('resetBookmarkGridLayout rebuilds one column per top-level folder', () => {
    const tree = buildTree([
      folder('10', 'Work', []),
      folder('20', 'Personal', []),
      folder('48', 'Reddit', []),
    ]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [
        ...createDefaultLayoutState().columns,
        { id: 'grid:combined', type: 'bookmarkGrid', order: 2000, enabled: true, stack: ['10', '20'] },
      ],
    };

    const reset = resetBookmarkGridLayout(layout, tree);
    const gridCols = reset.columns.filter((c) => c.type === 'bookmarkGrid');

    expect(gridCols.length).toBeGreaterThanOrEqual(3);
    const bookmarkOnlyCols = gridCols.filter(
      (c) => c.type === 'bookmarkGrid' && c.stack.every((id) => !id.startsWith('special:'))
    );
    expect(bookmarkOnlyCols.map((c) => c.stack)).toEqual([['10'], ['20'], ['48']]);
  });

  it('dedupes folder ids assigned to multiple columns during reconciliation', () => {
    const tree = buildTree([folder('10', 'Work', []), folder('48', 'Reddit', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [
        { id: 'grid:10', type: 'bookmarkGrid', order: 0, enabled: true, stack: ['10', '48'] },
        { id: 'grid:48', type: 'bookmarkGrid', order: 1, enabled: true, stack: ['48'] },
      ],
    };

    const { columns } = reconcileBookmarkColumns(tree, layout);

    expect(columns.flatMap((c) => stackFolders(c).map((f) => f.bookmarkId)).sort()).toEqual(['10', '48']);
  });

  it('drops disabled special sections from the rendered grid while keeping layout placement', () => {
    const tree = buildTree([folder('10', 'Work', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: createDefaultLayoutState().columns.map((col) => {
        if (col.type === 'specialSection' && col.id === 'special:mostVisited') {
          return { ...col, enabled: false };
        }
        return col;
      }),
    };

    const { columns, layout: reconciled } = reconcileBookmarkColumns(tree, layout);

    expect(reconciled.columns.find((c) => c.id === 'grid:special:mostVisited')).toBeDefined();
    expect(reconciled.columns.find((c) => c.id === 'grid:special:mostVisited')?.type).toBe('bookmarkGrid');
    expect(columns.find((c) => c.id === 'grid:special:mostVisited')).toBeUndefined();
  });

  it('restores section visibility in place when re-enabled after disable', () => {
    const tree = buildTree([folder('10', 'Work', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: createDefaultLayoutState().columns.map((col) => {
        if (col.type === 'specialSection' && col.id === 'special:mostVisited') {
          return { ...col, enabled: false };
        }
        return col;
      }),
    };

    const disabled = reconcileBookmarkColumns(tree, layout);
    expect(disabled.columns.find((c) => c.id === 'grid:special:mostVisited')).toBeUndefined();

    const reenabledLayout: LayoutState = {
      ...disabled.layout,
      columns: disabled.layout.columns.map((col) =>
        col.type === 'specialSection' && col.id === 'special:mostVisited'
          ? { ...col, enabled: true }
          : col
      ),
    };
    const { columns: restoredColumns } = reconcileBookmarkColumns(tree, reenabledLayout);
    expect(restoredColumns.find((c) => c.id === 'grid:special:mostVisited')).toBeDefined();
  });

  it('restores enabled special sections that were removed from stacks when disabled', () => {
    const tree = buildTree([folder('10', 'Work', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: createDefaultLayoutState().columns.map((col) => {
        if (col.type === 'specialSection' && col.id === 'special:mostVisited') {
          return { ...col, enabled: true };
        }
        return col;
      }),
    };

    const { columns, layout: reconciled } = reconcileBookmarkColumns(tree, layout);
    const sectionCol = reconciled.columns.find((c) => c.id === 'grid:special:mostVisited');

    expect(sectionCol?.type).toBe('bookmarkGrid');
    expect(sectionCol?.type === 'bookmarkGrid' && sectionCol.stack).toEqual(['special:mostVisited']);
    expect(
      columns.some((c) => c.stack.some((e) => e.kind === 'section' && e.sectionId === 'special:mostVisited'))
    ).toBe(true);
  });

  it('keeps a grid column when it still has bookmarks after disabling a stacked section', () => {
    const tree = buildTree([folder('10', 'Work', [])]);
    const layout: LayoutState = {
      ...createDefaultLayoutState(),
      columns: [
        ...createDefaultLayoutState().columns.filter((c) => c.type === 'specialSection'),
        { id: 'grid:combined', type: 'bookmarkGrid', order: 0, enabled: true, stack: ['special:apps', '10'] },
      ],
    };
    const disabledApps = layout.columns.map((col) =>
      col.type === 'specialSection' && col.id === 'special:apps' ? { ...col, enabled: false } : col
    );
    const layoutWithDisabledApps = { ...layout, columns: disabledApps };

    const { columns, layout: reconciled } = reconcileBookmarkColumns(tree, layoutWithDisabledApps);
    const combined = reconciled.columns.find((c) => c.id === 'grid:combined');

    expect(combined?.type).toBe('bookmarkGrid');
    expect(combined?.type === 'bookmarkGrid' && combined.stack).toEqual(['special:apps', '10']);
    expect(columns.find((c) => c.id === 'grid:combined')?.stack.some((e) => e.kind === 'folder')).toBe(true);
    expect(columns.find((c) => c.id === 'grid:combined')?.stack.some((e) => e.kind === 'section')).toBe(false);
  });
});
