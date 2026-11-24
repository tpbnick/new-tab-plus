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

  it('rejects array folderState and filters non-object entries in columns', () => {
    const coerced = coerceLayoutState({
      schemaVersion: 3,
      columns: [null, 'bad', 42, { id: 'grid:1', type: 'bookmarkGrid', order: 0, enabled: true, stack: ['1'] }],
      folderState: ['not-a-map'],
    });
    expect(coerced.folderState).toEqual({});
    expect(coerced.columns).toHaveLength(1);
    expect(coerced.columns[0].id).toBe('grid:1');
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

  it('removes duplicate built-in widget columns without mutating caller objects', () => {
    const firstSettings = { units: 'metric' };
    const firstCol = {
      id: 'widget:weather-1',
      type: 'widget' as const,
      order: 100,
      enabled: false,
      widgetId: 'weather',
      instanceId: '1',
      settings: firstSettings,
    };
    const layout = {
      ...createDefaultLayoutState(),
      columns: [
        ...createDefaultLayoutState().columns,
        firstCol,
        {
          id: 'widget:weather-2',
          type: 'widget',
          order: 101,
          enabled: true,
          widgetId: 'weather',
          instanceId: '2',
          settings: { city: 'Paris' },
        },
      ],
    } as LayoutState;

    expect(isLayoutNormalized(layout)).toBe(false);

    const normalized = normalizeLayoutColumns(layout);
    const weatherCols = normalized.columns.filter((c) => c.type === 'widget' && c.widgetId === 'weather');
    expect(weatherCols).toHaveLength(1);
    expect(weatherCols[0]).toMatchObject({
      enabled: true,
      settings: { city: 'Paris', units: 'metric' },
    });
    expect(firstCol.enabled).toBe(false);
    expect(firstCol.settings).toEqual({ units: 'metric' });
    expect(isLayoutNormalized(normalized)).toBe(true);
  });

  it('filters non-string entries in stack and flags unnormalized schemaVersion', () => {
    const layout = {
      schemaVersion: 0,
      columns: [
        {
          id: 'grid:1',
          type: 'bookmarkGrid',
          order: 0,
          enabled: true,
          stack: ['1', 123, null, '2'],
        },
      ],
      folderState: {},
    } as unknown as LayoutState;

    expect(isLayoutNormalized(layout)).toBe(false);
    const normalized = normalizeLayoutColumns(layout);
    expect(normalized.schemaVersion).toBe(3);
    expect(normalized.columns[0].type === 'bookmarkGrid' && normalized.columns[0].stack).toEqual(['1', '2']);
    expect(isLayoutNormalized(normalized)).toBe(true);
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
