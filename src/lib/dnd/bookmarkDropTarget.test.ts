import { describe, expect, it } from 'vitest';
import {
  buildInsertZonesForTest,
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
