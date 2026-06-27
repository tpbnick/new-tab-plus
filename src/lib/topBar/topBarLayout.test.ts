import { describe, expect, it, beforeEach } from 'vitest';
import { createDefaultLayoutState, createDefaultOptionsState } from '../storage/schema';
import type { TopBarItemId } from '../storage/schema';
import { registerBuiltinWidgets } from '../../widgets/registerAll';
import { setBuiltinWidgetEnabled } from '../widgets/widgetLayout';
import {
  clampSearchMaxWidthPx,
  moveTopBarItem,
  normalizeTopBarItemOrder,
  resolveVisibleTopBarOrder,
  SEARCH_MAX_WIDTH_PX,
} from './topBarLayout';

beforeEach(() => {
  registerBuiltinWidgets();
});

describe('topBarLayout', () => {
  it('normalizes item order with missing and duplicate ids', () => {
    expect(normalizeTopBarItemOrder(['weather', 'search', 'weather', 'invalid' as never])).toEqual([
      'weather',
      'search',
      'clock',
    ]);
  });

  it('filters disabled widgets from visible order', () => {
    const layout = createDefaultLayoutState();
    const topBar = {
      ...createDefaultOptionsState().topBar,
      itemOrder: ['clock', 'search', 'weather'] as TopBarItemId[],
    };
    setBuiltinWidgetEnabled(layout, 'clock', true);

    expect(resolveVisibleTopBarOrder(topBar, layout)).toEqual(['clock', 'search']);
  });

  it('hides search when disabled', () => {
    const layout = createDefaultLayoutState();
    const topBar = {
      ...createDefaultOptionsState().topBar,
      searchEnabled: false,
    };
    setBuiltinWidgetEnabled(layout, 'clock', true);

    expect(resolveVisibleTopBarOrder(topBar, layout)).toEqual(['clock']);
  });

  it('moves items within bounds', () => {
    const order: TopBarItemId[] = ['search', 'clock', 'weather'];
    expect(moveTopBarItem(order, 'clock', -1)).toEqual(['clock', 'search', 'weather']);
    expect(moveTopBarItem(order, 'clock', 1)).toEqual(['search', 'weather', 'clock']);
    expect(moveTopBarItem(order, 'search', -1)).toEqual(order);
  });

  it('clamps search max width to 200–1000px', () => {
    expect(clampSearchMaxWidthPx(1500)).toBe(SEARCH_MAX_WIDTH_PX);
    expect(clampSearchMaxWidthPx(100)).toBe(200);
    expect(clampSearchMaxWidthPx(750)).toBe(750);
  });
});
