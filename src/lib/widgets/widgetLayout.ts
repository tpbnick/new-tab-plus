import { widgetRegistry } from '../../widgets/registry';
import type { LayoutState, WidgetColumnMeta } from '../storage/schema';

/** Built-in widgets shown in the top bar next to search. One instance each. Clock is left of weather. */
export const TOP_BAR_WIDGET_DISPLAY_ORDER = ['clock', 'weather'] as const;
export const BUILTIN_TOP_BAR_WIDGETS = TOP_BAR_WIDGET_DISPLAY_ORDER;
export type BuiltinTopBarWidgetId = (typeof BUILTIN_TOP_BAR_WIDGETS)[number];

const TOP_BAR_WIDGET_ORDER: Record<BuiltinTopBarWidgetId, number> = {
  clock: 100,
  weather: 101,
};

export function isTopBarWidget(widgetId: string): widgetId is BuiltinTopBarWidgetId {
  return (BUILTIN_TOP_BAR_WIDGETS as readonly string[]).includes(widgetId);
}

export function findWidgetColumn(
  layout: LayoutState,
  widgetId: string
): WidgetColumnMeta | undefined {
  return layout.columns.find(
    (col): col is WidgetColumnMeta => col.type === 'widget' && col.widgetId === widgetId
  );
}

export function isBuiltinWidgetEnabled(layout: LayoutState, widgetId: BuiltinTopBarWidgetId): boolean {
  return findWidgetColumn(layout, widgetId)?.enabled ?? false;
}

export function setBuiltinWidgetEnabled(
  layout: LayoutState,
  widgetId: BuiltinTopBarWidgetId,
  enabled: boolean
): LayoutState {
  const existing = findWidgetColumn(layout, widgetId);

  if (enabled) {
    if (existing) {
      existing.enabled = true;
      return layout;
    }
    if (!widgetRegistry.get(widgetId)) return layout;

    const newMeta: WidgetColumnMeta = {
      id: `widget:${widgetId}`,
      type: 'widget',
      order: TOP_BAR_WIDGET_ORDER[widgetId],
      enabled: true,
      widgetId,
      instanceId: widgetId,
      settings: {},
    };
    layout.columns.push(newMeta);
    return layout;
  }

  if (existing) existing.enabled = false;
  return layout;
}

/** Keep at most one column entry per built-in widget id. Later duplicates fill missing settings. */
export function dedupeBuiltinWidgetColumns(columns: LayoutState['columns']): LayoutState['columns'] {
  const keptIndex = new Map<string, number>();
  const result: LayoutState['columns'] = [];
  let changed = false;

  for (const col of columns) {
    if (col.type !== 'widget' || !BUILTIN_TOP_BAR_WIDGETS.includes(col.widgetId as BuiltinTopBarWidgetId)) {
      result.push(col);
      continue;
    }
    const existingIdx = keptIndex.get(col.widgetId);
    if (existingIdx === undefined) {
      keptIndex.set(col.widgetId, result.length);
      result.push(col);
      continue;
    }
    changed = true;
    const existing = result[existingIdx] as WidgetColumnMeta;
    const existingSettings =
      existing.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings)
        ? existing.settings
        : {};
    const dupSettings =
      col.settings && typeof col.settings === 'object' && !Array.isArray(col.settings)
        ? col.settings
        : {};
    result[existingIdx] = {
      ...existing,
      settings: { ...dupSettings, ...existingSettings },
      enabled: existing.enabled || col.enabled,
    };
  }

  return changed ? result : columns;
}
