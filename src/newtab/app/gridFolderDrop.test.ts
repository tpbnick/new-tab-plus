import { afterEach, describe, expect, it } from 'vitest';
import type { BookmarkGridColumnMeta, ColumnEntry } from '../../lib/storage/schema';
import { createDefaultLayoutState } from '../../lib/storage/schema';
import { handleGridFolderNewColumn } from './gridFolderDrop';
import { appState } from './state';

function grid(id: string, stack: string[], order: number): BookmarkGridColumnMeta {
  return { id, type: 'bookmarkGrid', order, enabled: true, stack };
}

function idsInOrder(columns: ColumnEntry[]): string[] {
  return [...columns].sort((a, b) => a.order - b.order).map((column) => column.id);
}

function stacksInOrder(columns: ColumnEntry[]): string[][] {
  return [...columns]
    .sort((a, b) => a.order - b.order)
    .filter((column): column is BookmarkGridColumnMeta => column.type === 'bookmarkGrid')
    .map((column) => column.stack);
}

describe('handleGridFolderNewColumn', () => {
  afterEach(() => {
    appState.layoutState = createDefaultLayoutState();
    appState.layoutDirty = false;
  });

  it('places a namesake folder in the gap to the left of its column', async () => {
    appState.layoutState = {
      ...createDefaultLayoutState(),
      columns: [grid('grid:10', ['10', '20'], 0), grid('grid:30', ['30'], 1)],
    };

    await handleGridFolderNewColumn('10', 'grid:10', 'grid:10', async () => {});

    expect(idsInOrder(appState.layoutState.columns)).toEqual(['grid:10', 'grid:20', 'grid:30']);
    expect(stacksInOrder(appState.layoutState.columns)).toEqual([['10'], ['20'], ['30']]);
  });

  it('places a namesake folder in the gap to the right of its column', async () => {
    appState.layoutState = {
      ...createDefaultLayoutState(),
      columns: [grid('grid:10', ['10', '20'], 0), grid('grid:30', ['30'], 1)],
    };

    await handleGridFolderNewColumn('10', 'grid:10', 'grid:30', async () => {});

    expect(idsInOrder(appState.layoutState.columns)).toEqual(['grid:20', 'grid:10', 'grid:30']);
    expect(stacksInOrder(appState.layoutState.columns)).toEqual([['20'], ['10'], ['30']]);
  });

  it('places a namesake folder after the last column', async () => {
    appState.layoutState = {
      ...createDefaultLayoutState(),
      columns: [grid('grid:10', ['10', '20'], 0), grid('grid:30', ['30'], 1)],
    };

    await handleGridFolderNewColumn('10', 'grid:10', null, async () => {});

    expect(idsInOrder(appState.layoutState.columns)).toEqual(['grid:20', 'grid:30', 'grid:10']);
  });

  it('places a non-namesake folder to the left of the source column', async () => {
    appState.layoutState = {
      ...createDefaultLayoutState(),
      columns: [grid('grid:10', ['10', '20'], 0), grid('grid:30', ['30'], 1)],
    };

    await handleGridFolderNewColumn('20', 'grid:10', 'grid:10', async () => {});

    expect(idsInOrder(appState.layoutState.columns)).toEqual(['grid:20', 'grid:10', 'grid:30']);
    expect(stacksInOrder(appState.layoutState.columns)).toEqual([['20'], ['10'], ['30']]);
  });

  it('puts the new column where a removed source column was', async () => {
    appState.layoutState = {
      ...createDefaultLayoutState(),
      columns: [
        grid('grid:5', ['5'], 0),
        grid('grid:other', ['8'], 1),
        grid('grid:9', ['9'], 2),
      ],
    };

    await handleGridFolderNewColumn('8', 'grid:other', 'grid:other', async () => {});

    expect(idsInOrder(appState.layoutState.columns)).toEqual(['grid:5', 'grid:8', 'grid:9']);
    expect(stacksInOrder(appState.layoutState.columns)).toEqual([['5'], ['8'], ['9']]);
  });

  it('keeps a widget column in place when a folder splits beside it', async () => {
    appState.layoutState = {
      ...createDefaultLayoutState(),
      columns: [
        grid('grid:10', ['10', '20'], 0),
        {
          id: 'widget:clock',
          type: 'widget',
          order: 1,
          enabled: true,
          widgetId: 'clock',
          instanceId: 'c1',
          settings: {},
        },
      ],
    };

    await handleGridFolderNewColumn('10', 'grid:10', 'widget:clock', async () => {});

    expect(idsInOrder(appState.layoutState.columns)).toEqual(['grid:20', 'grid:10', 'widget:clock']);
  });

  it('leaves a solo column where it is when the drop is on its own leading edge', async () => {
    let persisted = false;
    appState.layoutState = {
      ...createDefaultLayoutState(),
      columns: [grid('grid:10', ['10'], 0), grid('grid:30', ['30'], 1)],
    };

    await handleGridFolderNewColumn('10', 'grid:10', 'grid:10', async () => {
      persisted = true;
    });

    expect(persisted).toBe(false);
    expect(appState.layoutDirty).toBe(false);
    expect(idsInOrder(appState.layoutState.columns)).toEqual(['grid:10', 'grid:30']);
  });

  it('moves a solo column before another column', async () => {
    let persisted = false;
    appState.layoutState = {
      ...createDefaultLayoutState(),
      columns: [grid('grid:10', ['10'], 0), grid('grid:30', ['30'], 1)],
    };

    await handleGridFolderNewColumn('30', 'grid:30', 'grid:10', async () => {
      persisted = true;
    });

    expect(persisted).toBe(true);
    expect(idsInOrder(appState.layoutState.columns)).toEqual(['grid:30', 'grid:10']);
  });
});
