import { describe, expect, it } from 'vitest';
import { createDefaultLayoutState, type LayoutState } from './schema';
import {
  coerceLayoutState,
  isLayoutNormalized,
  normalizeLayoutColumns,
  sanitizeLayoutState,
} from './layoutNormalize';

describe('coerceLayoutState', () => {
  it('fills in missing columns array', () => {
    const coerced = coerceLayoutState({ schemaVersion: 2, folderState: {} });
    expect(Array.isArray(coerced.columns)).toBe(true);
    expect(coerced.columns.length).toBeGreaterThan(0);
  });
});

describe('normalizeLayoutColumns', () => {
  it('converts legacy bookmarkFolder columns to bookmarkGrid', () => {
    const layout = {
      ...createDefaultLayoutState(),
      columns: [
        ...createDefaultLayoutState().columns,
        {
          id: 'bm:10',
          type: 'bookmarkFolder',
          order: 0,
          enabled: true,
          bookmarkId: '10',
        },
      ],
    } as LayoutState;

    const normalized = normalizeLayoutColumns(layout);

    expect(normalized.columns.find((c) => c.id === 'grid:10')).toEqual({
      id: 'grid:10',
      type: 'bookmarkGrid',
      order: 0,
      enabled: true,
      stack: ['10'],
    });
    expect(isLayoutNormalized(normalized)).toBe(true);
  });

  it('repairs bookmarkGrid columns missing stack using legacy bookmarkId', () => {
    const layout = {
      ...createDefaultLayoutState(),
      columns: [
        ...createDefaultLayoutState().columns,
        {
          id: 'grid:10',
          type: 'bookmarkGrid',
          order: 0,
          enabled: true,
          bookmarkId: '10',
        } as unknown as LayoutState['columns'][number],
      ],
    };

    const normalized = normalizeLayoutColumns(layout);
    const grid = normalized.columns.find((c) => c.id === 'grid:10');
    expect(grid?.type === 'bookmarkGrid' && grid.stack).toEqual(['10']);
  });

  it('returns the same reference when nothing needs repair', () => {
    const layout = createDefaultLayoutState();
    expect(normalizeLayoutColumns(layout)).toBe(layout);
  });

  it('removes duplicate built-in widget columns', () => {
    const layout = {
      ...createDefaultLayoutState(),
      columns: [
        ...createDefaultLayoutState().columns,
        {
          id: 'widget:weather-1',
          type: 'widget',
          order: 100,
          enabled: true,
          widgetId: 'weather',
          instanceId: '1',
          settings: {},
        },
        {
          id: 'widget:weather-2',
          type: 'widget',
          order: 101,
          enabled: true,
          widgetId: 'weather',
          instanceId: '2',
          settings: {},
        },
      ],
    } as LayoutState;

    const normalized = normalizeLayoutColumns(layout);
    const weatherCols = normalized.columns.filter((c) => c.type === 'widget' && c.widgetId === 'weather');
    expect(weatherCols).toHaveLength(1);
  });
});

describe('sanitizeLayoutState', () => {
  it('coerces and normalizes corrupt stored layout payloads', () => {
    const sanitized = sanitizeLayoutState({
      schemaVersion: 2,
      columns: [{ id: 'bm:10', type: 'bookmarkFolder', order: 0, enabled: true, bookmarkId: '10' }],
    });

    expect(sanitized.columns.find((c) => c.id === 'grid:10')).toMatchObject({
      type: 'bookmarkGrid',
      stack: ['10'],
    });
  });
});
