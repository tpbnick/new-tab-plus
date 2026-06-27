import { widgetRegistry } from '../../widgets/registry';
import type { WidgetContext, WidgetInstance } from '../../widgets/contract';
import type { WidgetColumnMeta } from '../storage/schema';

export interface WidgetColumnCallbacks {
  onSettingsSaved(instanceId: string, partial: Record<string, unknown>): Promise<boolean>;
}

export interface WidgetColumnOptions {
  /** 'column' (default) renders the standard bordered column with a title
   *  header, draggable/reorderable among other columns. 'inline' renders
   *  just the widget body for widgets pinned outside the grid (e.g. clock
   *  and weather in the top bar). Settings live in the settings sidebar. */
  variant?: 'column' | 'inline';
  lockColumns?: boolean;
}

export interface WidgetColumnResult {
  element: HTMLElement;
  instance: WidgetInstance | null;
}

export function renderWidgetColumn(
  meta: WidgetColumnMeta,
  callbacks: WidgetColumnCallbacks,
  options: WidgetColumnOptions = {}
): WidgetColumnResult {
  const variant = options.variant ?? 'column';
  const wrapper = document.createElement('section');
  wrapper.className = variant === 'inline' ? 'widget-inline' : 'column';

  if (variant === 'column') {
    wrapper.dataset.dragKind = 'column';
    wrapper.dataset.columnId = meta.id;
  }

  if (variant === 'inline') {
    wrapper.dataset.widgetId = meta.widgetId;
  }

  const definition = widgetRegistry.get(meta.widgetId);

  if (variant === 'column') {
    const header = document.createElement('div');
    header.className = 'column__header';
    const title = document.createElement('h2');
    title.className = 'column__title';
    title.draggable = !options.lockColumns;
    title.textContent = definition?.displayName ?? meta.widgetId;
    header.appendChild(title);
    wrapper.appendChild(header);
  }

  const body = document.createElement('div');
  body.className = 'widget-body';
  wrapper.appendChild(body);

  if (!definition) {
    body.textContent = `Unknown widget: ${meta.widgetId}`;
    return { element: wrapper, instance: null };
  }

  const mergedSettings: Record<string, unknown> = { ...definition.defaultSettings, ...meta.settings };
  let instanceRef: WidgetInstance | null = null;

  const ctx: WidgetContext = {
    instanceId: meta.instanceId,
    getSetting: <T>(key: string) => mergedSettings[key] as T,
    saveSettings: async (partial) => {
      Object.assign(mergedSettings, partial);
      const skipRefresh = await callbacks.onSettingsSaved(meta.instanceId, partial);
      if (!skipRefresh) {
        await instanceRef?.refresh?.();
      }
    },
  };

  const instance = definition.create(body, mergedSettings, ctx);
  instanceRef = instance;
  void instance.render();

  return { element: wrapper, instance };
}
