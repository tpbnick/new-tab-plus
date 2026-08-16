import {
  getOptionsLocal,
  getOptionsSynced,
  isSelfStorageWrite,
  loadLayout,
  setOptionsLocal,
} from '../lib/storage/storage';
import { attachNonSelectableLabels } from '../lib/ui/collapsible';
import { hideUpdateBanner, initUpdateChecker, runUpdateCheck } from '../lib/updates/updateCheck';
import { navigateExternalUrl } from '../lib/render/externalLink';
import { openWebSearch } from '../lib/search/searchEngine';
import { attachCommandPalette } from '../lib/search/commandPalette';
import { attachGlobalShortcuts } from '../lib/keyboard/globalShortcuts';
import { registerBuiltinWidgets } from '../widgets/registerAll';
import { createSettingsModal } from './settingsModal';
import { announceDndDebug } from '../lib/debug/dndDebug';
import type { SettingsDeps } from '../lib/settings/settingsPanels';
import { invalidateSpecialSectionCache } from '../lib/sections/specialSectionCache';
import { applyLiveCustomCss, applyLiveTheme } from './app/themeLive';
import { applyExtensionPageIcon, renderSettingsButton, showRenderError } from './app/domUI';
import { getBookmarkSearchEntries } from './app/bookmarkIndex';
import {
  flushPendingSavesAsync,
  resetBookmarkLayout,
  saveLayout,
  saveLayoutNow,
  saveOptions,
  saveOptionsNow,
  saveOptionsLocal,
  setLayoutDirect,
  setOptionsDirect,
  setOptionsLocalDirect,
  setSyncToCloud,
} from './app/layoutPersistence';
import {
  applyOptionsFromStorage,
  handleRemoteOptionsChange,
  invalidateMostVisitedOnFocus,
  persistLayoutAndRenderLayout,
  rebindGridInteractions,
  render,
  scheduleBookmarkRefresh,
  scheduleRender,
  createWidgetRefreshFn,
  renderTopBarInDom,
} from './app/pageRenderer';
import { appState } from './app/state';
import { saveWidgetSettings } from './app/widgetSettings';

registerBuiltinWidgets();
announceDndDebug();
applyExtensionPageIcon();

const persistAndRender = () => persistLayoutAndRenderLayout();

function settingsStorageArea(): 'sync' | 'local' {
  return appState.optionsLocalState.syncToCloud ? 'sync' : 'local';
}

function hasPendingOptionsSave(): boolean {
  return appState.saveOptionsTimer !== undefined;
}

function hasPendingOptionsLocalSave(): boolean {
  return appState.saveOptionsLocalTimer !== undefined;
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.optionsLocal && !isSelfStorageWrite('local', 'optionsLocal')) {
    if (hasPendingOptionsLocalSave()) return;
    void applyOptionsFromStorage();
    return;
  }

  const expectedArea = settingsStorageArea();
  if (areaName !== expectedArea) return;

  if (changes.options) {
    if (hasPendingOptionsSave() || isSelfStorageWrite(expectedArea, 'options')) return;
    const previous = appState.optionsState;
    void applyOptionsFromStorage().then(() => {
      if (isSelfStorageWrite(expectedArea, 'options')) return;
      handleRemoteOptionsChange(previous);
    });
    return;
  }

  if (
    (changes.layout || changes.folderState) &&
    !isSelfStorageWrite(expectedArea, 'layout') &&
    !isSelfStorageWrite(expectedArea, 'folderState')
  ) {
    if (appState.layoutDirty || appState.pendingWidgetSettingsSaves.size > 0) {
      return;
    }
    scheduleRender();
  }
});

chrome.bookmarks.onCreated.addListener(scheduleBookmarkRefresh);
chrome.bookmarks.onRemoved.addListener(scheduleBookmarkRefresh);
chrome.bookmarks.onChanged.addListener(scheduleBookmarkRefresh);
chrome.bookmarks.onMoved.addListener(scheduleBookmarkRefresh);

chrome.sessions.onChanged.addListener(() => {
  invalidateSpecialSectionCache('recentlyClosed');
  invalidateSpecialSectionCache('otherDevices');
  scheduleRender('bookmarks');
});

const updateCheckContext = {
  getCheckEnabled: () => appState.optionsState.general.checkForUpdates,
  getDismissedVersion: () => appState.optionsLocalState.dismissedUpdateVersion,
  setDismissedVersion: async (version: string) => {
    appState.optionsLocalState = { ...appState.optionsLocalState, dismissedUpdateVersion: version };
    await setOptionsLocal(appState.optionsLocalState);
  },
};

initUpdateChecker(updateCheckContext);

const settingsDeps: SettingsDeps = {
  get layout() {
    return appState.layoutState;
  },
  get options() {
    return appState.optionsState;
  },
  get optionsLocal() {
    return appState.optionsLocalState;
  },
  saveLayout: () => saveLayout(persistAndRender),
  saveLayoutNow: () => saveLayoutNow(persistAndRender),
  saveOptions,
  saveOptionsNow,
  saveOptionsLocal,
  refreshPanel: () => {},
  rerenderPage: () => {
    appState.cachedTopBarKey = '';
    scheduleRender();
  },
  rebindGridInteractions,
  saveWidgetSettings: (widgetId, partial) =>
    saveWidgetSettings(widgetId, partial, renderTopBarInDom, scheduleRender),
  resetBookmarkLayout: () => {
    void resetBookmarkLayout(persistAndRender);
  },
  setLayoutDirect: (layout) => setLayoutDirect(layout, persistAndRender),
  setOptionsDirect: (options) => setOptionsDirect(options, handleRemoteOptionsChange),
  setOptionsLocalDirect,
  setSyncToCloud,
  flushPendingSaves: () => flushPendingSavesAsync(createWidgetRefreshFn()),
  onCheckForUpdatesChange: (enabled) => {
    if (enabled) {
      void runUpdateCheck(updateCheckContext, { force: true });
      return;
    }
    hideUpdateBanner();
  },
};

const settingsModal = createSettingsModal(settingsDeps);
appState.openSettingsModal = () => settingsModal.open();

document.body.appendChild(settingsModal.element);
document.body.appendChild(renderSettingsButton(() => settingsModal.toggle()));

const commandPalette = attachCommandPalette({
  getBookmarkEntries: () => getBookmarkSearchEntries(),
  openUrl: (url) => navigateExternalUrl(url, appState.optionsState.general.openLinksInSameTab),
  searchWeb: (query) => {
    openWebSearch(appState.optionsState.topBar.searchEngine, query);
  },
  isBlocked: () =>
    !settingsModal.element.hidden ||
    document.body.classList.contains('is-folder-dragging'),
});

attachGlobalShortcuts({
  openSettings: () => settingsModal.open(),
  isSettingsOpen: () => !settingsModal.element.hidden,
  isCommandPaletteOpen: () => commandPalette.isOpen(),
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    void flushPendingSavesAsync(createWidgetRefreshFn());
    return;
  }
  invalidateMostVisitedOnFocus();
  window.clearTimeout(appState.focusRefreshTimer);
  appState.focusRefreshTimer = window.setTimeout(() => scheduleRender('bookmarks'), 300);
});

const appRoot = document.getElementById('app');
if (appRoot) attachNonSelectableLabels(appRoot);

void (async () => {
  try {
    const local = await getOptionsLocal();
    const synced = await getOptionsSynced();
    const { layout } = await loadLayout();
    appState.layoutState = layout;
    appState.optionsState = synced;
    appState.optionsLocalState = local;
    applyLiveTheme();
    applyLiveCustomCss();
    await render('full');
    void runUpdateCheck(updateCheckContext);
  } catch (err) {
    console.error('[new-tab-plus] initial render failed', err);
    showRenderError('Something went wrong loading your new tab. Please try again.', () =>
      scheduleRender()
    );
  }
})();
