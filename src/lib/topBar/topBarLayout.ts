import type { LayoutState, OptionsState, TopBarItemId } from '../storage/schema';
import { BUILTIN_TOP_BAR_WIDGETS, isBuiltinWidgetEnabled } from '../widgets/widgetLayout';

export type { TopBarItemId };

export const ALL_TOP_BAR_ITEM_IDS: TopBarItemId[] = ['search', ...BUILTIN_TOP_BAR_WIDGETS];

export const SEARCH_MAX_WIDTH_PX = 1000;

export function clampSearchMaxWidthPx(value: number): number {
  return Math.min(SEARCH_MAX_WIDTH_PX, Math.max(200, Math.round(value)));
}

export const TOP_BAR_ITEM_LABELS: Record<TopBarItemId, string> = {
  search: 'Search bar',
  clock: 'Clock',
  weather: 'Weather',
};

export function normalizeTopBarItemOrder(order: TopBarItemId[] | undefined): TopBarItemId[] {
  const seen = new Set<TopBarItemId>();
  const result: TopBarItemId[] = [];

  for (const id of order ?? []) {
    if (!ALL_TOP_BAR_ITEM_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  for (const id of ALL_TOP_BAR_ITEM_IDS) {
    if (!seen.has(id)) result.push(id);
  }

  return result;
}

export function resolveVisibleTopBarOrder(
  topBar: OptionsState['topBar'],
  layout: LayoutState
): TopBarItemId[] {
  return normalizeTopBarItemOrder(topBar.itemOrder).filter((id) => {
    if (id === 'search') return topBar.searchEnabled;
    return isBuiltinWidgetEnabled(layout, id);
  });
}

export function moveTopBarItem(
  order: TopBarItemId[],
  itemId: TopBarItemId,
  direction: -1 | 1
): TopBarItemId[] {
  const normalized = normalizeTopBarItemOrder(order);
  const index = normalized.indexOf(itemId);
  if (index < 0) return normalized;

  const target = index + direction;
  if (target < 0 || target >= normalized.length) return normalized;

  const next = [...normalized];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function applyTopBar(topBar: OptionsState['topBar'], root: HTMLElement = document.documentElement): void {
  if (topBar.fullWidth) {
    root.dataset.topBarFullWidth = 'true';
    root.style.removeProperty('--ntp-top-bar-max-width');
  } else {
    delete root.dataset.topBarFullWidth;
    root.style.setProperty('--ntp-top-bar-max-width', `${topBar.maxWidthPx}px`);
  }

  root.style.setProperty('--ntp-top-bar-gap', `${topBar.gapPx}px`);
  root.style.setProperty('--ntp-search-max-width', `${clampSearchMaxWidthPx(topBar.searchMaxWidthPx)}px`);
  root.style.setProperty('--ntp-top-bar-widget-height', `${topBar.widgetHeightPx}px`);
  root.style.setProperty('--ntp-top-bar-widget-scale', String(topBar.widgetScale));
}
