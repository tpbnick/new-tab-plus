import { setLayout, setOptionsLocal, setOptionsSynced } from '../../lib/storage/storage';
import { resetBookmarkGridLayout } from '../../lib/bookmarks/bookmarkTree';
import { LayoutPersistError } from '../../lib/storage/layoutPersistError';
import { showSaveError } from '../../lib/ui/saveErrorBanner';
import { mergeOptionsState, type LayoutState, type OptionsLocalState, type OptionsState } from '../../lib/storage/schema';
import { applyCustomCss, validateCustomCss } from '../../lib/theme/themeEngine';
import { appState, markLayoutDirty } from './state';
import { applyLiveTheme } from './themeLive';

export async function persistLayout(): Promise<void> {
  try {
    await setLayout(appState.layoutState);
    appState.layoutDirty = false;
  } catch (err) {
    console.error('[new-tab-plus] failed to save layout', err);
    showSaveError('Could not save layout. Check Chrome sync storage space.');
    throw new LayoutPersistError(err);
  }
}

export function setFolderCollapsed(folderId: string, collapsed: boolean): void {
  appState.layoutState.folderState[folderId] = { collapsed };
  markLayoutDirty();
  appState.layoutUpdateChain = appState.layoutUpdateChain
    .then(async () => {
      await persistLayout();
    })
    .catch((err) => {
      console.error('[new-tab-plus] failed to save folder state', err);
      if (!(err instanceof LayoutPersistError)) {
        showSaveError('Could not save folder state.');
      }
    });
}

export function saveLayout(persistAndRenderLayout: () => Promise<void>): void {
  markLayoutDirty();
  window.clearTimeout(appState.saveLayoutTimer);
  appState.saveLayoutTimer = window.setTimeout(() => void persistAndRenderLayout(), 200);
}

export function saveLayoutNow(persistAndRenderLayout: () => Promise<void>): void {
  markLayoutDirty();
  window.clearTimeout(appState.saveLayoutTimer);
  void persistAndRenderLayout();
}

export function saveOptions(): void {
  applyLiveTheme();
  window.clearTimeout(appState.saveOptionsTimer);
  appState.saveOptionsTimer = window.setTimeout(() => {
    void setOptionsSynced(appState.optionsState).catch((err) => {
      console.error('[new-tab-plus] failed to save options', err);
      showSaveError('Could not save settings. Check Chrome sync storage space.');
    });
  }, 200);
}

export function saveOptionsNow(): void {
  applyLiveTheme();
  window.clearTimeout(appState.saveOptionsTimer);
  void setOptionsSynced(appState.optionsState).catch((err) => {
    console.error('[new-tab-plus] failed to save options', err);
    showSaveError('Could not save settings. Check Chrome sync storage space.');
  });
}

export function saveOptionsLocal(): void {
  if (validateCustomCss(appState.optionsLocalState.customCss).ok) {
    applyCustomCss(appState.optionsLocalState.customCss);
  }
  window.clearTimeout(appState.saveOptionsLocalTimer);
  appState.saveOptionsLocalTimer = window.setTimeout(() => {
    void setOptionsLocal(appState.optionsLocalState).catch((err) => {
      console.error('[new-tab-plus] failed to save local options', err);
      showSaveError('Could not save local settings.');
    });
  }, 200);
}

export async function flushPendingSavesAsync(
  refreshWidgetUiAfterSettingsSave: (widgetId: string) => void
): Promise<void> {
  window.clearTimeout(appState.saveLayoutTimer);
  window.clearTimeout(appState.saveOptionsTimer);
  window.clearTimeout(appState.saveOptionsLocalTimer);
  window.clearTimeout(appState.saveWidgetSettingsTimer);

  const widgetIds = [...appState.pendingWidgetSettingsSaves];
  appState.pendingWidgetSettingsSaves.clear();

  const needsLayoutPersist = appState.layoutDirty || widgetIds.length > 0;
  const saves: Promise<void>[] = [];
  if (needsLayoutPersist) {
    saves.push(persistLayout());
  }
  saves.push(
    setOptionsSynced(appState.optionsState).catch((err) => {
      console.error('[new-tab-plus] failed to save options', err);
      showSaveError('Could not save settings. Check Chrome sync storage space.');
    }),
    setOptionsLocal(appState.optionsLocalState).catch((err) => {
      console.error('[new-tab-plus] failed to save local options', err);
      showSaveError('Could not save local settings.');
    })
  );
  await Promise.all(saves);

  for (const widgetId of widgetIds) {
    refreshWidgetUiAfterSettingsSave(widgetId);
  }
}

export function setLayoutDirect(
  newLayout: LayoutState,
  persistAndRenderLayout: () => Promise<void>
): void {
  appState.layoutState = newLayout;
  markLayoutDirty();
  void persistAndRenderLayout();
}

export function setOptionsDirect(
  newOptions: OptionsState,
  handleRemoteOptionsChange: (previous: OptionsState) => void
): void {
  const previous = appState.optionsState;
  appState.optionsState = mergeOptionsState(newOptions);
  applyLiveTheme();
  void setOptionsSynced(appState.optionsState).catch((err) => {
    console.error('[new-tab-plus] failed to save options', err);
    showSaveError('Could not save settings. Check Chrome sync storage space.');
  });
  handleRemoteOptionsChange(previous);
}

export function setOptionsLocalDirect(newOptionsLocal: OptionsLocalState): void {
  appState.optionsLocalState = {
    ...appState.optionsLocalState,
    ...newOptionsLocal,
    customCss: newOptionsLocal.customCss,
    dismissedUpdateVersion: newOptionsLocal.dismissedUpdateVersion,
  };
  applyCustomCss(appState.optionsLocalState.customCss);
  void setOptionsLocal(appState.optionsLocalState).catch((err) => {
    console.error('[new-tab-plus] failed to save local options', err);
    showSaveError('Could not save local settings.');
  });
}

export async function resetBookmarkLayout(persistAndRenderLayout: () => Promise<void>): Promise<void> {
  const tree = await chrome.bookmarks.getTree();
  appState.layoutState = resetBookmarkGridLayout(appState.layoutState, tree);
  markLayoutDirty();
  await persistAndRenderLayout();
}
