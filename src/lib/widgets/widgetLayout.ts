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
  const kept = new Map<string, WidgetColumnMeta>();
  return columns.filter((col) => {
    if (col.type !== 'widget') return true;
    if (!BUILTIN_TOP_BAR_WIDGETS.includes(col.widgetId as BuiltinTopBarWidgetId)) return true;
    const existing = kept.get(col.widgetId);
    if (!existing) {
      kept.set(col.widgetId, col);
      return true;
    }
    existing.settings = { ...col.settings, ...existing.settings };
    existing.enabled = existing.enabled || col.enabled;
    return false;
  });
}
