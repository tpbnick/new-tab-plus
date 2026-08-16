import { setLayout, setOptionsLocal, setOptionsSynced } from '../../lib/storage/storage';
import { resetBookmarkGridLayout } from '../../lib/bookmarks/bookmarkTree';
import { LayoutPersistError } from '../../lib/storage/layoutPersistError';
import { showSaveError } from '../../lib/ui/saveErrorBanner';
import {
  mergeOptionsState,
  type FolderUiState,
  type LayoutState,
  type OptionsLocalState,
  type OptionsState,
} from '../../lib/storage/schema';
import { applyCustomCss } from '../../lib/theme/themeEngine';
import { applyCollapsedState } from '../../lib/ui/collapsible';
import { appState, markLayoutDirty } from './state';
import { applyLiveTheme } from './themeLive';

let folderStateBeforeFlush: Record<string, FolderUiState> | null = null;

export async function persistLayoutUnqueued(): Promise<void> {
  try {
    appState.layoutState = await setLayout(appState.layoutState);
    appState.layoutDirty = false;
  } catch (err) {
    console.error('[new-tab-plus] failed to save layout', err);
    showSaveError('Could not save layout. Check Chrome sync storage space.');
    throw new LayoutPersistError(err);
  }
}

function enqueueLayoutTask(task: () => Promise<void>, fallbackMessage: string): Promise<void> {
  const run = appState.layoutUpdateChain.then(task);
  appState.layoutUpdateChain = run.catch((err) => {
    console.error('[new-tab-plus] layout update failed', err);
    if (!(err instanceof LayoutPersistError)) {
      showSaveError(fallbackMessage);
    }
  });
  return run;
}

export function persistLayout(): Promise<void> {
  return enqueueLayoutTask(() => persistLayoutUnqueued(), 'Could not save layout. Check Chrome sync storage space.');
}

function revertFolderCollapseUi(
  current: Record<string, FolderUiState>,
  previous: Record<string, FolderUiState>
): void {
  const ids = new Set([...Object.keys(current), ...Object.keys(previous)]);
  for (const id of ids) {
    const nextCollapsed = previous[id]?.collapsed ?? false;
    if ((current[id]?.collapsed ?? false) === nextCollapsed) continue;
    const escaped = CSS.escape(id);
    const el = document.querySelector<HTMLElement>(
      `[data-folder-id="${escaped}"], [data-bookmark-id="${escaped}"]`
    );
    if (el) applyCollapsedState(el, nextCollapsed);
  }
}

export function setFolderCollapsed(folderId: string, collapsed: boolean): void {
  if (!folderStateBeforeFlush) {
    folderStateBeforeFlush = { ...appState.layoutState.folderState };
  }
  appState.layoutState.folderState[folderId] = { collapsed };
  markLayoutDirty();
  window.clearTimeout(appState.saveFolderStateTimer);
  appState.saveFolderStateTimer = window.setTimeout(() => {
    const previous = folderStateBeforeFlush;
    folderStateBeforeFlush = null;
    void enqueueLayoutTask(async () => {
      try {
        await persistLayoutUnqueued();
      } catch (err) {
        if (previous) {
          revertFolderCollapseUi(appState.layoutState.folderState, previous);
          appState.layoutState.folderState = previous;
        }
        throw err;
      }
    }, 'Could not save folder state.');
  }, 200);
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
    appState.saveOptionsTimer = undefined;
    void setOptionsSynced(appState.optionsState).catch((err) => {
      console.error('[new-tab-plus] failed to save options', err);
      showSaveError('Could not save settings. Check Chrome sync storage space.');
    });
  }, 200);
}

export function saveOptionsNow(): void {
  applyLiveTheme();
  window.clearTimeout(appState.saveOptionsTimer);
  appState.saveOptionsTimer = undefined;
  void setOptionsSynced(appState.optionsState).catch((err) => {
    console.error('[new-tab-plus] failed to save options', err);
    showSaveError('Could not save settings. Check Chrome sync storage space.');
  });
}

export function saveOptionsLocal(): void {
  applyCustomCss(appState.optionsLocalState.customCss);
  applyLiveTheme();
  window.clearTimeout(appState.saveOptionsLocalTimer);
  appState.saveOptionsLocalTimer = window.setTimeout(() => {
    appState.saveOptionsLocalTimer = undefined;
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
  window.clearTimeout(appState.saveFolderStateTimer);
  appState.saveOptionsTimer = undefined;
  appState.saveOptionsLocalTimer = undefined;
  appState.saveFolderStateTimer = undefined;
  const folderSnapshot = folderStateBeforeFlush;
  folderStateBeforeFlush = null;

  const widgetIds = [...appState.pendingWidgetSettingsSaves];
  const needsLayoutPersist = appState.layoutDirty || widgetIds.length > 0;
  const saves: Promise<void>[] = [];
  if (needsLayoutPersist) {
    saves.push(
      persistLayout()
        .then(() => {
          for (const widgetId of widgetIds) {
            appState.pendingWidgetSettingsSaves.delete(widgetId);
          }
        })
        .catch((err) => {
          if (folderSnapshot) {
            revertFolderCollapseUi(appState.layoutState.folderState, folderSnapshot);
            appState.layoutState.folderState = folderSnapshot;
          }
          console.error('[new-tab-plus] failed to flush layout', err);
        })
    );
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

  if (needsLayoutPersist && widgetIds.every((id) => !appState.pendingWidgetSettingsSaves.has(id))) {
    for (const widgetId of widgetIds) {
      refreshWidgetUiAfterSettingsSave(widgetId);
    }
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
    syncToCloud: newOptionsLocal.syncToCloud,
    uploadedBackgroundImage: newOptionsLocal.uploadedBackgroundImage,
  };
  applyCustomCss(appState.optionsLocalState.customCss);
  applyLiveTheme();
  void setOptionsLocal(appState.optionsLocalState).catch((err) => {
    console.error('[new-tab-plus] failed to save local options', err);
    showSaveError('Could not save local settings.');
  });
}

export async function setSyncToCloud(enabled: boolean): Promise<void> {
  const previous = appState.optionsLocalState.syncToCloud;
  appState.optionsLocalState = { ...appState.optionsLocalState, syncToCloud: enabled };
  try {
    await setOptionsLocal(appState.optionsLocalState);
    await persistLayout();
    await setOptionsSynced(appState.optionsState);
  } catch (err) {
    appState.optionsLocalState = { ...appState.optionsLocalState, syncToCloud: previous };
    await setOptionsLocal(appState.optionsLocalState).catch((rollbackErr) => {
      console.error('[new-tab-plus] failed to revert save-to-cloud', rollbackErr);
    });
    throw err;
  }
}

export async function resetBookmarkLayout(persistAndRenderLayout: () => Promise<void>): Promise<void> {
  const tree = await chrome.bookmarks.getTree();
  appState.layoutState = resetBookmarkGridLayout(appState.layoutState, tree);
  markLayoutDirty();
  await persistAndRenderLayout();
}
