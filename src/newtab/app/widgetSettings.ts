import { isTopBarWidget } from '../../lib/widgets/widgetLayout';
import { LayoutPersistError } from '../../lib/storage/layoutPersistError';
import { showSaveError } from '../../lib/ui/saveErrorBanner';
import type { WidgetColumnMeta } from '../../lib/storage/schema';
import type { WidgetInstance } from '../../widgets/contract';
import { appState, markLayoutDirty } from './state';
import { persistLayout } from './layoutPersistence';
import type { ScheduleRender } from './types';

function mergeWidgetSettings(meta: WidgetColumnMeta, partial: Record<string, unknown>): void {
  if (!meta.settings || typeof meta.settings !== 'object') {
    meta.settings = {};
  }
  Object.assign(meta.settings, partial);
}

function invalidateTopBarCacheIfNeeded(widgetId: string): void {
  if (isTopBarWidget(widgetId)) {
    appState.cachedTopBarKey = '';
  }
}

export function saveWidgetSettings(
  widgetId: string,
  partial: Record<string, unknown>,
  renderTopBar: () => void,
  scheduleRender: ScheduleRender
): void {
  const meta = appState.layoutState.columns.find(
    (c): c is WidgetColumnMeta => c.type === 'widget' && c.widgetId === widgetId
  );
  if (!meta) return;
  mergeWidgetSettings(meta, partial);
  invalidateTopBarCacheIfNeeded(meta.widgetId);
  if (isTopBarWidget(meta.widgetId)) {
    renderTopBar();
  }
  markLayoutDirty();
  appState.pendingWidgetSettingsSaves.add(widgetId);
  window.clearTimeout(appState.saveWidgetSettingsTimer);
  appState.saveWidgetSettingsTimer = window.setTimeout(() => {
    void persistPendingWidgetSettings((id) =>
      refreshWidgetUiAfterSettingsSave(id, renderTopBar, scheduleRender)
    );
  }, 200);
}

export function refreshWidgetUiAfterSettingsSave(
  widgetId: string,
  renderTopBar: () => void,
  scheduleRender: ScheduleRender
): void {
  const meta = appState.layoutState.columns.find(
    (c): c is WidgetColumnMeta => c.type === 'widget' && c.widgetId === widgetId
  );
  if (!meta) return;

  if (isTopBarWidget(meta.widgetId)) {
    renderTopBar();
    return;
  }

  const slot = appState.gridWidgetSlots.get(meta.instanceId);
  if (slot) {
    slot.instance.destroy();
    appState.gridWidgetSlots.delete(meta.instanceId);
    scheduleRender('bookmarks');
  }
}

async function persistPendingWidgetSettings(
  refreshFn: (widgetId: string) => void
): Promise<void> {
  const widgetIds = [...appState.pendingWidgetSettingsSaves];
  appState.pendingWidgetSettingsSaves.clear();
  if (widgetIds.length === 0) return;

  try {
    await persistLayout();
    for (const widgetId of widgetIds) {
      refreshFn(widgetId);
    }
  } catch (err) {
    console.error('[new-tab-plus] failed to save widget settings', err);
    if (!(err instanceof LayoutPersistError)) {
      showSaveError('Could not save widget settings.');
    }
  }
}

export async function handleWidgetSettingsSaved(
  instanceId: string,
  partial: Record<string, unknown>,
  renderTopBar: () => void,
  scheduleRender: ScheduleRender
): Promise<boolean> {
  const meta = appState.layoutState.columns.find(
    (c): c is WidgetColumnMeta => c.type === 'widget' && c.instanceId === instanceId
  );
  if (!meta) return true;
  mergeWidgetSettings(meta, partial);
  invalidateTopBarCacheIfNeeded(meta.widgetId);
  markLayoutDirty();

  try {
    await persistLayout();

    if (isTopBarWidget(meta.widgetId)) {
      renderTopBar();
      return true;
    }

    const slot = appState.gridWidgetSlots.get(instanceId);
    if (slot) {
      slot.instance.destroy();
      appState.gridWidgetSlots.delete(instanceId);
      scheduleRender('bookmarks');
      return true;
    }

    scheduleRender('full');
    return true;
  } catch (err) {
    console.error('[new-tab-plus] failed to save widget settings', err);
    showSaveError('Could not save widget settings.');
    return false;
  }
}

export function destroyTopBarWidgets(): void {
  appState.topBarWidgetInstances.forEach((instance: WidgetInstance) => instance.destroy());
  appState.topBarWidgetInstances = [];
}
