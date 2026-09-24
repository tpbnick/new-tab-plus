import { describe, expect, it } from 'vitest';
import {
  buildInsertZonesForTest,
  resolveGridFolderDrop,
  resolveInsertFromZonesForTest,
} from './bookmarkDropTarget';

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

function mockColumn(id: string, left: number, width: number): HTMLElement {
  const el = { dataset: { columnId: id } } as unknown as HTMLElement;
  el.getBoundingClientRect = () => rect(left, width);
  return el;
}

describe('column insert zones', () => {
  it('places the before-first line one half-gap left of the column, not at the viewport edge', () => {
    const columns = [mockColumn('first', 400, 220), mockColumn('second', 650, 220)];
    const zones = buildInsertZonesForTest(columns);
    const gap = 650 - 620; // 30px between columns

    expect(zones[0]?.lineX).toBe(400 - gap / 2);
    expect(zones[0]?.zoneLeft).toBe(400 - gap);
    expect(zones[0]?.zoneRight).toBe(400);
    expect(resolveInsertFromZonesForTest(zones, 400 - gap / 2)?.beforeColumnId).toBe('first');
  });

  it('places the after-last line one half-gap right of the column', () => {
    const columns = [mockColumn('first', 100, 220), mockColumn('last', 350, 220)];
    const zones = buildInsertZonesForTest(columns);
    const gap = 350 - 320;

    const afterLast = zones[zones.length - 1];
    expect(afterLast?.lineX).toBe(570 + gap / 2);
    expect(afterLast?.zoneLeft).toBe(570);
    expect(afterLast?.zoneRight).toBe(570 + gap);
  });

  it('uses the same gap width for a single column', () => {
    const columns = [mockColumn('solo', 200, 220)];
    const zones = buildInsertZonesForTest(columns);

    expect(zones[0]?.zoneRight - zones[0]?.zoneLeft).toBe(48);
    expect(zones[1]?.zoneRight - zones[1]?.zoneLeft).toBe(48);
    expect(zones[0]?.lineX).toBe(200 - 24);
  });
});

function stubRect(el: HTMLElement, left: number, width: number, top = 0, height = 400): void {
  el.getBoundingClientRect = () => rect(left, width, top, height);
}

function folderBlock(folderId: string, top: number): HTMLElement {
  const block = document.createElement('div');
  block.className = 'folder-column-block';
  block.dataset.folderId = folderId;
  stubRect(block, 100, 200, top, 70);

  const header = document.createElement('div');
  header.className = 'folder-column-header';
  header.dataset.folderId = folderId;
  stubRect(header, 100, 200, top, 28);
  block.appendChild(header);
  return block;
}

function bookmarkColumn(id: string, left: number, folderIds: string[]): HTMLElement {
  const column = document.createElement('div');
  column.className = 'column column--bookmark-grid';
  column.dataset.columnId = id;
  column.dataset.gridColumnId = id;
  stubRect(column, left, 200);
  folderIds.forEach((folderId, index) => {
    column.appendChild(folderBlock(folderId, 16 + index * 80));
  });
  return column;
}

describe('resolveGridFolderDrop', () => {
  it('starts a new column only in the gap or the outer margin', () => {
    const host = document.createElement('div');
    stubRect(host, 0, 800);
    const source = bookmarkColumn('grid:10', 100, ['10', '20']);
    const next = bookmarkColumn('grid:30', 330, ['30']);
    host.append(source, next);

    expect(resolveGridFolderDrop(host, '10', 315, 30)).toMatchObject({
      mode: 'newColumn',
      beforeColumnId: 'grid:30',
    });
    expect(resolveGridFolderDrop(host, '10', 85, 30)).toMatchObject({
      mode: 'newColumn',
      beforeColumnId: 'grid:10',
    });
    expect(resolveGridFolderDrop(host, '10', 110, 40)).toMatchObject({ mode: 'into' });
    expect(resolveGridFolderDrop(host, '10', 290, 40)).toMatchObject({ mode: 'into' });
  });

  it('uses the top half of a folder for above and the bottom half for below', () => {
    const host = document.createElement('div');
    stubRect(host, 0, 800);
    const source = bookmarkColumn('grid:10', 100, ['10', '20']);
    host.append(source, bookmarkColumn('grid:30', 330, ['30']));

    const above = resolveGridFolderDrop(host, '10', 110, 110);
    expect(above).toMatchObject({
      mode: 'into',
      gridColumnId: 'grid:10',
      targetFolderId: '20',
      position: 'before',
    });

    const below = resolveGridFolderDrop(host, '10', 110, 150);
    expect(below).toMatchObject({
      mode: 'into',
      gridColumnId: 'grid:10',
      targetFolderId: '20',
      position: 'after',
    });

    const ontoNextColumn = resolveGridFolderDrop(host, '10', 400, 20);
    expect(ontoNextColumn).toMatchObject({
      mode: 'into',
      gridColumnId: 'grid:30',
      targetFolderId: '30',
      position: 'before',
    });
  });

  it('moves a solo column from the gap and leaves the column body alone', () => {
    const host = document.createElement('div');
    stubRect(host, 0, 800);
    host.append(bookmarkColumn('grid:10', 100, ['10']), bookmarkColumn('grid:30', 330, ['30']));

    expect(resolveGridFolderDrop(host, '10', 200, 30)).toBeNull();
    expect(resolveGridFolderDrop(host, '10', 315, 30)).toMatchObject({
      mode: 'newColumn',
      beforeColumnId: 'grid:30',
    });
    expect(resolveGridFolderDrop(host, '10', 560, 30)).toMatchObject({
      mode: 'newColumn',
      beforeColumnId: null,
    });
  });

  it('ignores a nearby column gap while the pointer is still on a solo column', () => {
    const host = document.createElement('div');
    stubRect(host, 0, 800);
    host.append(bookmarkColumn('grid:10', 100, ['10']), bookmarkColumn('grid:30', 308, ['30']));

    expect(resolveGridFolderDrop(host, '10', 260, 30)).toBeNull();
  });

  it('does not start a new column while the pointer is on a widget column', () => {
    const host = document.createElement('div');
    stubRect(host, 0, 800);
    const widget = document.createElement('section');
    widget.className = 'column';
    widget.dataset.columnId = 'widget:clock';
    stubRect(widget, 330, 200);
    host.append(bookmarkColumn('grid:10', 100, ['10', '20']), widget);

    expect(resolveGridFolderDrop(host, '10', 400, 40)).toBeNull();
    expect(resolveGridFolderDrop(host, '10', 315, 40)).toMatchObject({
      mode: 'newColumn',
      beforeColumnId: 'widget:clock',
    });
  });
});
