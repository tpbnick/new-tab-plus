import { reconcileBookmarkColumns } from '../../lib/bookmarks/bookmarkTree';
import {
  refreshBookmarksGrid,
} from '../../lib/render/bookmarksGridRenderer';
import { renderBookmarksGridEmpty } from '../../lib/render/bookmarksGridEmpty';
import { loadSpecialSectionCached, invalidateSpecialSectionCache } from '../../lib/sections/specialSectionCache';
import type { SpecialSectionViewModel } from '../../lib/sections';
import { attachPointerFolderDrag } from '../../lib/dnd/pointerBookmarkDrag';
import { attachCollapsible } from '../../lib/ui/collapsible';
import { LayoutPersistError } from '../../lib/storage/layoutPersistError';
import { showSaveError } from '../../lib/ui/saveErrorBanner';
import {
  getLayout,
  getOptionsLocal,
  getOptionsSynced,
  optionsAffectLayout,
  optionsOnlyGridInteractionsChanged,
  setLayout,
} from '../../lib/storage/storage';
import { renderSearchBar } from '../../lib/search/searchBar';
import { renderWidgetColumn } from '../../lib/render/widgetColumnRenderer';
import { isTopBarWidget } from '../../lib/widgets/widgetLayout';
import { resolveVisibleTopBarOrder } from '../../lib/topBar/topBarLayout';
import { coalesceRenderScope, type RenderScope } from '../../lib/render/renderScope';
import { fnv1aHash } from '../../lib/ui/fnv1aHash';
import type {
  BookmarkGridColumnMeta,
  LayoutState,
  OptionsLocalState,
  OptionsState,
  SpecialSectionMeta,
  WidgetColumnMeta,
} from '../../lib/storage/schema';
import type { BookmarkColumnViewModel } from '../../lib/types';
import type { BookmarkColumnRenderOptions } from '../../lib/render/bookmarkColumnRenderer';
import { updateBookmarkSearchIndex } from './bookmarkIndex';
import { clearRenderError, ensureRegions, showRenderError } from './domUI';
import {
  handleGridFolderDrop,
  handleStackKeyboardMove,
  type PersistLayoutAndRender,
} from './gridFolderDrop';
import { persistLayout, setFolderCollapsed } from './layoutPersistence';
import { applyLiveCustomCss, applyLiveTheme } from './themeLive';
import { appState } from './state';
import {
  destroyTopBarWidgets,
  handleWidgetSettingsSaved,
  refreshWidgetUiAfterSettingsSave,
} from './widgetSettings';

export function scheduleRender(scope: RenderScope = 'full'): void {
  appState.pendingRenderScope = coalesceRenderScope(appState.pendingRenderScope, scope);
  window.clearTimeout(appState.renderTimer);
  appState.renderTimer = window.setTimeout(() => {
    const scopeToRun = appState.pendingRenderScope ?? 'full';
    appState.pendingRenderScope = null;
    appState.layoutUpdateChain = appState.layoutUpdateChain
      .then(async () => {
        await render(scopeToRun);
      })
      .catch((err) => {
        console.error('[new-tab-plus] render failed', err);
      });
  }, 150);
}

export function scheduleBookmarkRefresh(): void {
  scheduleRender('bookmarks');
}

export function handleRemoteOptionsChange(previous: OptionsState): void {
  if (optionsAffectLayout(previous, appState.optionsState)) {
    appState.cachedTopBarKey = '';
    scheduleRender();
    return;
  }
  if (!optionsOnlyGridInteractionsChanged(previous, appState.optionsState)) return;

  rebindGridInteractions();
  if (previous.general.lockColumns !== appState.optionsState.general.lockColumns) {
    scheduleRender('bookmarks');
  }
}

function getSearchBarElement(): HTMLElement {
  if (!appState.searchBarElement) {
    appState.searchBarElement = renderSearchBar(() => appState.optionsState.topBar.searchEngine);
  }
  return appState.searchBarElement;
}

function buildTopBarKey(topBar: OptionsState['topBar'], layout: LayoutState): string {
  const order = resolveVisibleTopBarOrder(topBar, layout);
  const settingsKey = order
    .filter((id) => id !== 'search')
    .map((id) => {
      const meta = layout.columns.find(
        (col): col is WidgetColumnMeta => col.type === 'widget' && col.widgetId === id
      );
      return meta ? fnv1aHash(JSON.stringify(meta.settings)) : '';
    })
    .join(';');
  return `${order.join('|')}|${settingsKey}`;
}

function renderTopBar(
  topBar: HTMLElement,
  layout: LayoutState,
  topBarItemOrder: ReturnType<typeof resolveVisibleTopBarOrder>
): void {
  const topBarWidgetMeta = layout.columns.filter(
    (m): m is WidgetColumnMeta => m.type === 'widget' && m.enabled && isTopBarWidget(m.widgetId)
  );
  const topBarWidgetById = new Map(topBarWidgetMeta.map((m) => [m.widgetId, m]));
  const topBarKey = buildTopBarKey(appState.optionsState.topBar, layout);
  if (topBarKey === appState.cachedTopBarKey) return;

  destroyTopBarWidgets();
  topBar.replaceChildren();
  appState.cachedTopBarKey = topBarKey;
  appState.searchBarElement = null;

  const widgetColumnCallbacks = {
    onSettingsSaved: (instanceId: string, partial: Record<string, unknown>) =>
      handleWidgetSettingsSaved(instanceId, partial, () => renderTopBarInDom(), scheduleRender),
  };

  for (const itemId of topBarItemOrder) {
    if (itemId === 'search') {
      topBar.appendChild(getSearchBarElement());
      continue;
    }
    const meta = topBarWidgetById.get(itemId);
    if (!meta) continue;
    const { element, instance } = renderWidgetColumn(meta, widgetColumnCallbacks, {
      variant: 'inline',
    });
    topBar.appendChild(element);
    if (instance) appState.topBarWidgetInstances.push(instance);
  }
}

export function renderTopBarInDom(): void {
  const topBar = document.querySelector<HTMLElement>('.top-bar');
  if (!topBar) return;
  renderTopBar(
    topBar,
    appState.layoutState,
    resolveVisibleTopBarOrder(appState.optionsState.topBar, appState.layoutState)
  );
}

function renderEmptyGridState(): HTMLElement {
  return renderBookmarksGridEmpty(() => appState.openSettingsModal());
}

function neededSpecialSectionIds(
  gridColumnMeta: Array<BookmarkGridColumnMeta | WidgetColumnMeta>,
  bookmarkColumnsById: Map<string, BookmarkColumnViewModel>
): Set<string> {
  const ids = new Set<string>();
  for (const meta of gridColumnMeta) {
    if (meta.type !== 'bookmarkGrid') continue;
    const vm = bookmarkColumnsById.get(meta.id);
    if (!vm) continue;
    for (const entry of vm.stack) {
      if (entry.kind === 'section') ids.add(entry.sectionId);
    }
  }
  return ids;
}

function needsGridInteractionRebind(optionsSynced: OptionsState): boolean {
  return (
    appState.lastBoundExpandOnHover !== optionsSynced.general.expandCollapsedOnHover ||
    appState.lastBoundLockColumns !== optionsSynced.general.lockColumns
  );
}

export function attachGridInteractions(
  bookmarksGrid: HTMLElement,
  optionsSynced: OptionsState
): void {
  appState.detachFolderDnd?.();
  appState.detachCollapsible?.();

  const locked = optionsSynced.general.lockColumns;
  document.body.classList.toggle('is-columns-locked', locked);
  bookmarksGrid.classList.toggle('is-columns-locked', locked);

  const persistLayoutAndRender: PersistLayoutAndRender = () => persistLayoutAndRenderLayout();

  if (!locked) {
    appState.detachFolderDnd = attachPointerFolderDrag(bookmarksGrid, {
      onGridFolderDrop: (folderId, sourceGridColumnId, target) => {
        void handleGridFolderDrop(folderId, sourceGridColumnId, target, persistLayoutAndRender);
      },
    });
  } else {
    appState.detachFolderDnd = null;
  }

  appState.detachCollapsible = attachCollapsible(bookmarksGrid, {
    expandOnHover: optionsSynced.general.expandCollapsedOnHover,
    onCollapsedChange: setFolderCollapsed,
    columnsLocked: locked,
    onStackKeyboardMove: locked
      ? undefined
      : (folderId, sourceGridColumnId, direction) => {
          void handleStackKeyboardMove(
            folderId,
            sourceGridColumnId,
            direction,
            persistLayoutAndRender
          );
        },
  });
  appState.lastBoundExpandOnHover = optionsSynced.general.expandCollapsedOnHover;
  appState.lastBoundLockColumns = locked;
}

export function rebindGridInteractions(): void {
  const bookmarksGrid = document.querySelector<HTMLElement>('.bookmarks-grid');
  if (bookmarksGrid) attachGridInteractions(bookmarksGrid, appState.optionsState);
}

function refreshGrid(
  bookmarksGrid: HTMLElement,
  gridColumnMeta: Array<BookmarkGridColumnMeta | WidgetColumnMeta>,
  bookmarkColumnsById: Map<string, BookmarkColumnViewModel>,
  linkOptions: BookmarkColumnRenderOptions,
  optionsSynced: OptionsState,
  rebindInteractions: boolean
): void {
  const widgetColumnCallbacks = {
    onSettingsSaved: (instanceId: string, partial: Record<string, unknown>) =>
      handleWidgetSettingsSaved(instanceId, partial, () => renderTopBarInDom(), scheduleRender),
  };

  const { widgetSlots, gridDomChanged } = refreshBookmarksGrid({
    bookmarksGrid,
    gridColumnMeta,
    bookmarkColumnsById,
    linkOptions,
    widgetCallbacks: widgetColumnCallbacks,
    widgetSlots: appState.gridWidgetSlots,
    renderEmpty: () => renderEmptyGridState(),
  });
  appState.gridWidgetSlots = widgetSlots;
  if (rebindInteractions || gridDomChanged || needsGridInteractionRebind(optionsSynced)) {
    attachGridInteractions(bookmarksGrid, optionsSynced);
  }
}

async function safeLoadSpecialSection(
  meta: SpecialSectionMeta,
  bypassCache = false,
  ttlMs?: number
): Promise<SpecialSectionViewModel> {
  return loadSpecialSectionCached(meta, { bypassCache, ttlMs });
}

export async function render(scope: RenderScope = 'full'): Promise<void> {
  const generation = ++appState.renderGeneration;
  const app = document.getElementById('app');
  if (!app) return;

  try {
    const tree = await chrome.bookmarks.getTree();
    if (generation !== appState.renderGeneration) return;

    updateBookmarkSearchIndex(tree);

    const skipOptionsFetch = scope === 'bookmarks';
    let storedLayout: LayoutState;
    let optionsSynced: OptionsState;
    let optionsLocal: OptionsLocalState;

    if (skipOptionsFetch) {
      storedLayout = appState.layoutState;
      optionsSynced = appState.optionsState;
      optionsLocal = appState.optionsLocalState;
    } else {
      [storedLayout, optionsSynced, optionsLocal] = await Promise.all([
        getLayout(),
        getOptionsSynced(),
        getOptionsLocal(),
      ]);
    }
    if (generation !== appState.renderGeneration) return;

    if (!skipOptionsFetch) {
      appState.optionsState = optionsSynced;
      appState.optionsLocalState = optionsLocal;
      applyLiveTheme();
      applyLiveCustomCss();
    }

    const baseLayout = appState.layoutDirty ? appState.layoutState : storedLayout;
    let { layout, columns } = reconcileBookmarkColumns(tree, baseLayout);
    const layoutStructureChanged = layout !== baseLayout;

    if (layoutStructureChanged) {
      try {
        await setLayout(layout);
        appState.layoutDirty = false;
      } catch (err) {
        console.error('[new-tab-plus] failed to save layout', err);
        showSaveError('Could not save layout. Check Chrome sync storage space.');
      }
      if (generation !== appState.renderGeneration) return;
    }

    appState.layoutState = layout;

    const bookmarkColumnsById = new Map(columns.map((c) => [c.id, c]));
    const sortedMeta = [...layout.columns].sort((a, b) => a.order - b.order).filter((c) => c.enabled);

    const topBarItemOrder = resolveVisibleTopBarOrder(appState.optionsState.topBar, layout);
    const gridColumnMeta = sortedMeta.filter(
      (m): m is BookmarkGridColumnMeta | WidgetColumnMeta =>
        m.type === 'bookmarkGrid' ||
        (m.type === 'widget' && !isTopBarWidget(m.widgetId))
    );

    const neededSectionIds = neededSpecialSectionIds(gridColumnMeta, bookmarkColumnsById);
    const specialSectionMetas = layout.columns.filter(
      (m): m is SpecialSectionMeta =>
        m.type === 'specialSection' && m.enabled && neededSectionIds.has(m.id)
    );
    const specialSectionVms = await Promise.all(
      specialSectionMetas.map((meta) =>
        safeLoadSpecialSection(
          meta,
          false,
          meta.kind === 'mostVisited' ? 15_000 : undefined
        )
      )
    );
    if (generation !== appState.renderGeneration) return;

    if (appState.layoutDirty) {
      layout = { ...layout, folderState: { ...layout.folderState, ...appState.layoutState.folderState } };
      appState.layoutState = { ...appState.layoutState, folderState: layout.folderState };
      try {
        await setLayout(layout);
        appState.layoutDirty = false;
      } catch (err) {
        console.error('[new-tab-plus] failed to save layout', err);
        showSaveError('Could not save layout changes. Check Chrome sync storage space.');
      }
      if (generation !== appState.renderGeneration) return;
    }

    clearRenderError();

    const specialSectionsById = new Map(specialSectionVms.map((vm) => [vm.id, vm]));
    const linkOptions = {
      openLinksInSameTab: appState.optionsState.general.openLinksInSameTab,
      rememberOpenFolders: appState.optionsState.general.rememberOpenFolders,
      lockColumns: appState.optionsState.general.lockColumns,
      sectionsById: specialSectionsById,
      folderState: layout.folderState,
    };

    const { topBar, bookmarksGrid } = ensureRegions(app);
    const bookmarksOnly = scope === 'bookmarks' && !layoutStructureChanged;

    if (bookmarksOnly) {
      refreshGrid(
        bookmarksGrid,
        gridColumnMeta,
        bookmarkColumnsById,
        linkOptions,
        appState.optionsState,
        false
      );
      return;
    }

    const topBarKey = buildTopBarKey(appState.optionsState.topBar, layout);
    const rebuildTopBar = topBarKey !== appState.cachedTopBarKey;

    if (rebuildTopBar) {
      renderTopBar(topBar, layout, topBarItemOrder);
    }

    refreshGrid(
      bookmarksGrid,
      gridColumnMeta,
      bookmarkColumnsById,
      linkOptions,
      appState.optionsState,
      false
    );
  } catch (err) {
    console.error('[new-tab-plus] render failed', err);
    showRenderError('Something went wrong loading your new tab. Please try again.', () => scheduleRender());
  }
}

export async function persistLayoutAndRenderLayout(): Promise<void> {
  appState.layoutUpdateChain = appState.layoutUpdateChain
    .then(async () => {
      await persistLayout();
      await render('full');
    })
    .catch((err) => {
      console.error('[new-tab-plus] layout update failed', err);
      if (!(err instanceof LayoutPersistError)) {
        showSaveError('Could not save layout. Check Chrome sync storage space.');
      }
    });
  return appState.layoutUpdateChain;
}

export async function applyOptionsFromStorage(): Promise<void> {
  appState.optionsState = await getOptionsSynced();
  appState.optionsLocalState = await getOptionsLocal();
  applyLiveTheme();
  applyLiveCustomCss();
}

export function invalidateMostVisitedOnFocus(): void {
  invalidateSpecialSectionCache('mostVisited');
}

export function createWidgetRefreshFn(): (widgetId: string) => void {
  return (widgetId) =>
    refreshWidgetUiAfterSettingsSave(widgetId, () => renderTopBarInDom(), scheduleRender);
}
