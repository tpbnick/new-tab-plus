import {
  getLayout,
  getOptionsLocal,
  getOptionsSynced,
  isSelfStorageWrite,
  optionsAffectLayout,
  optionsOnlyGridInteractionsChanged,
  setLayout,
  setOptionsLocal,
  setOptionsSynced,
} from '../lib/storage/storage';
import { reconcileBookmarkColumns, resetBookmarkGridLayout } from '../lib/bookmarks/bookmarkTree';
import {
  refreshBookmarksGrid,
  type GridWidgetSlot,
} from '../lib/render/bookmarksGridRenderer';
import { renderBookmarksGridEmpty } from '../lib/render/bookmarksGridEmpty';
import { loadSpecialSectionCached, invalidateSpecialSectionCache } from '../lib/sections/specialSectionCache';
import type { SpecialSectionViewModel } from '../lib/sections';
import { attachPointerFolderDrag } from '../lib/dnd/pointerBookmarkDrag';
import { reorderIds } from '../lib/dnd/reorder';
import type { GridFolderDropResult } from '../lib/dnd/bookmarkDropTarget';
import {
  collectGridColumnIds,
  gridColumnIdForFolder,
  reIdSourceColumnAfterNamesakeSplit,
} from '../lib/dnd/gridFolderMove';
import { getColumnStack, setColumnStack } from '../lib/grid/gridStack';
import { applyBackground, applyCustomCss, applyGeneralOptions, applyTheme, validateCustomCss } from '../lib/theme/themeEngine';
import { attachCollapsible, attachNonSelectableLabels } from '../lib/ui/collapsible';
import { resolveStackKeyboardMove, type StackMoveDirection } from '../lib/dnd/keyboardStackMove';
import { LayoutPersistError } from '../lib/storage/layoutPersistError';
import { showSaveError } from '../lib/ui/saveErrorBanner';
import { hideUpdateBanner, initUpdateChecker, runUpdateCheck } from '../lib/updates/updateCheck';
import { applyTopBar } from '../lib/topBar/topBarLayout';
import { navigateExternalUrl } from '../lib/render/externalLink';
import { renderSearchBar } from '../lib/search/searchBar';
import { openWebSearch } from '../lib/search/searchEngine';
import { flattenBookmarkLinks, type BookmarkSearchEntry } from '../lib/search/bookmarkSearchIndex';
import { attachCommandPalette } from '../lib/search/commandPalette';
import { attachGlobalShortcuts } from '../lib/keyboard/globalShortcuts';
import { renderWidgetColumn } from '../lib/render/widgetColumnRenderer';
import { registerBuiltinWidgets } from '../widgets/registerAll';
import { isTopBarWidget } from '../lib/widgets/widgetLayout';
import { resolveVisibleTopBarOrder } from '../lib/topBar/topBarLayout';
import { createSettingsModal } from './settingsModal';
import { announceDndDebug, dndLog, dndWarn } from '../lib/debug/dndDebug';
import type { SettingsDeps } from '../lib/settings/settingsPanels';
import {
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
  mergeOptionsState,
  type BookmarkGridColumnMeta,
  type LayoutState,
  type OptionsLocalState,
  type OptionsState,
  type SpecialSectionMeta,
  type WidgetColumnMeta,
} from '../lib/storage/schema';
import type { BookmarkColumnViewModel } from '../lib/types';
import type { BookmarkColumnRenderOptions } from '../lib/render/bookmarkColumnRenderer';
import type { WidgetInstance } from '../widgets/contract';

import { coalesceRenderScope, type RenderScope } from '../lib/render/renderScope';
import { fnv1aHash } from '../lib/ui/fnv1aHash';

registerBuiltinWidgets();
announceDndDebug();
applyExtensionPageIcon();

function applyExtensionPageIcon(): void {
  const href = chrome.runtime.getURL('icons/icon-128.png');
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }
  link.href = href;
}

let layoutState: LayoutState = createDefaultLayoutState();
let optionsState: OptionsState = createDefaultOptionsState();
let optionsLocalState: OptionsLocalState = createDefaultOptionsLocalState();
let detachFolderDnd: (() => void) | null = null;
let detachCollapsible: (() => void) | null = null;
let topBarWidgetInstances: WidgetInstance[] = [];
let gridWidgetSlots = new Map<string, GridWidgetSlot>();
let bookmarkSearchEntries: BookmarkSearchEntry[] = [];
let lastBookmarkTreeSig = '';
let renderGeneration = 0;
let renderTimer: number | undefined;
let pendingRenderScope: RenderScope | null = null;
let cachedTopBarKey = '';
let layoutUpdateChain: Promise<void> = Promise.resolve();
let layoutDirty = false;
let lastBoundExpandOnHover: boolean | null = null;
let lastBoundLockColumns: boolean | null = null;

function markLayoutDirty(): void {
  layoutDirty = true;
}

function scheduleRender(scope: RenderScope = 'full'): void {
  pendingRenderScope = coalesceRenderScope(pendingRenderScope, scope);
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    const scopeToRun = pendingRenderScope ?? 'full';
    pendingRenderScope = null;
    layoutUpdateChain = layoutUpdateChain
      .then(async () => {
        await render(scopeToRun);
      })
      .catch((err) => {
        console.error('[new-tab-plus] render failed', err);
      });
  }, 150);
}

function scheduleBookmarkRefresh(): void {
  scheduleRender('bookmarks');
}

function bookmarkTreeSignature(tree: chrome.bookmarks.BookmarkTreeNode[]): string {
  const parts: string[] = [];
  function walk(nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[]): void {
    for (const node of nodes) {
      if (node.url) {
        parts.push(`${node.id}|${node.title}|${node.url}|${path.join(' › ')}`);
      }
      if (node.children?.length) {
        walk(node.children, [...path, node.title]);
      }
    }
  }
  for (const root of tree[0]?.children ?? []) {
    walk(root.children ?? [], [root.title]);
  }
  return parts.join('\n');
}

function updateBookmarkSearchIndex(tree: chrome.bookmarks.BookmarkTreeNode[]): void {
  const sig = bookmarkTreeSignature(tree);
  if (sig === lastBookmarkTreeSig) return;
  lastBookmarkTreeSig = sig;
  bookmarkSearchEntries = flattenBookmarkLinks(tree);
}

function showRenderError(message: string): void {
  const app = document.getElementById('app');
  if (!app) return;

  let banner = app.querySelector<HTMLElement>('.ntp-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'ntp-error-banner';
    banner.setAttribute('role', 'alert');
    app.prepend(banner);
  }

  banner.replaceChildren();
  const text = document.createElement('p');
  text.textContent = message;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry';
  retry.addEventListener('click', () => {
    banner?.remove();
    scheduleRender();
  });
  banner.append(text, retry);
}

function clearRenderError(): void {
  document.querySelector('.ntp-error-banner')?.remove();
}

function handleRemoteOptionsChange(previous: OptionsState): void {
  if (optionsAffectLayout(previous, optionsState)) {
    cachedTopBarKey = '';
    scheduleRender();
    return;
  }
  if (!optionsOnlyGridInteractionsChanged(previous, optionsState)) return;

  rebindGridInteractions();
  if (previous.general.lockColumns !== optionsState.general.lockColumns) {
    scheduleRender('bookmarks');
  }
}

function renderSettingsButton(onClick: () => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'settings-button';
  button.setAttribute('aria-label', 'Open settings');
  button.title = 'Settings (?)';
  button.textContent = '⚙';
  button.addEventListener('click', onClick);
  return button;
}

interface Regions {
  topBar: HTMLElement;
  bookmarksGrid: HTMLElement;
}

let searchBarElement: HTMLElement | null = null;

function getSearchBarElement(): HTMLElement {
  if (!searchBarElement) {
    searchBarElement = renderSearchBar(() => optionsState.topBar.searchEngine);
  }
  return searchBarElement;
}

function ensureRegions(app: HTMLElement): Regions {
  app.querySelector('.sections-row')?.remove();

  let main = app.querySelector<HTMLElement>('.ntp-main');
  if (!main) {
    main = document.createElement('div');
    main.className = 'ntp-main';

    const existingTopBar = app.querySelector('.top-bar');
    const existingGrid = app.querySelector('.bookmarks-grid');

    if (existingTopBar || existingGrid) {
      app.appendChild(main);
      if (existingTopBar) main.appendChild(existingTopBar);
      if (existingGrid) main.appendChild(existingGrid);
    } else {
      app.innerHTML = '';
      app.appendChild(main);
    }
  }

  let topBar = main.querySelector<HTMLElement>('.top-bar');
  let bookmarksGrid = main.querySelector<HTMLElement>('.bookmarks-grid');

  if (!topBar) {
    topBar = document.createElement('div');
    topBar.className = 'top-bar';
    main.insertBefore(topBar, bookmarksGrid);
  }

  if (!bookmarksGrid) {
    bookmarksGrid = document.createElement('div');
    bookmarksGrid.className = 'bookmarks-grid';
    main.appendChild(bookmarksGrid);
  }

  return { topBar, bookmarksGrid };
}

function applyLiveTheme(): void {
  applyTheme(optionsState.theme, optionsState.background);
  applyBackground(optionsState.background, optionsState.theme.colors.background);
  applyTopBar(optionsState.topBar);
  applyGeneralOptions(optionsState.general);
}

async function applyOptions(): Promise<void> {
  optionsState = await getOptionsSynced();
  optionsLocalState = await getOptionsLocal();
  applyLiveTheme();
  applyCustomCss(optionsLocalState.customCss);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.options) {
    const previous = optionsState;
    void applyOptions().then(() => {
      if (isSelfStorageWrite('sync', 'options')) return;
      handleRemoteOptionsChange(previous);
    });
    return;
  }
  if (areaName === 'local' && changes.optionsLocal) {
    void applyOptions();
    return;
  }
  if (areaName === 'sync' && changes.layout && !isSelfStorageWrite('sync', 'layout')) {
    void flushPendingSavesAsync().then(() => {
      layoutDirty = false;
      scheduleRender();
    });
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

async function safeLoadSpecialSection(
  meta: SpecialSectionMeta,
  bypassCache = false,
  ttlMs?: number
): Promise<SpecialSectionViewModel> {
  return loadSpecialSectionCached(meta, { bypassCache, ttlMs });
}

function attachGridInteractions(bookmarksGrid: HTMLElement, optionsSynced: OptionsState): void {
  detachFolderDnd?.();
  detachCollapsible?.();

  const locked = optionsSynced.general.lockColumns;
  document.body.classList.toggle('is-columns-locked', locked);
  bookmarksGrid.classList.toggle('is-columns-locked', locked);

  if (!locked) {
    detachFolderDnd = attachPointerFolderDrag(bookmarksGrid, {
      onGridFolderDrop: (folderId, sourceGridColumnId, target) => {
        void handleGridFolderDrop(folderId, sourceGridColumnId, target);
      },
    });
  } else {
    detachFolderDnd = null;
  }

  detachCollapsible = attachCollapsible(bookmarksGrid, {
    expandOnHover: optionsSynced.general.expandCollapsedOnHover,
    onCollapsedChange: setFolderCollapsed,
    columnsLocked: locked,
    onStackKeyboardMove: locked
      ? undefined
      : (folderId, sourceGridColumnId, direction) => {
          void handleStackKeyboardMove(folderId, sourceGridColumnId, direction);
        },
  });
  lastBoundExpandOnHover = optionsSynced.general.expandCollapsedOnHover;
  lastBoundLockColumns = locked;
}

function needsGridInteractionRebind(optionsSynced: OptionsState): boolean {
  return (
    lastBoundExpandOnHover !== optionsSynced.general.expandCollapsedOnHover ||
    lastBoundLockColumns !== optionsSynced.general.lockColumns
  );
}

function rebindGridInteractions(): void {
  const bookmarksGrid = document.querySelector<HTMLElement>('.bookmarks-grid');
  if (bookmarksGrid) attachGridInteractions(bookmarksGrid, optionsState);
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

function refreshGrid(
  bookmarksGrid: HTMLElement,
  gridColumnMeta: Array<BookmarkGridColumnMeta | WidgetColumnMeta>,
  bookmarkColumnsById: Map<string, BookmarkColumnViewModel>,
  linkOptions: BookmarkColumnRenderOptions,
  optionsSynced: OptionsState,
  rebindInteractions: boolean
): void {
  const { widgetSlots, gridDomChanged } = refreshBookmarksGrid({
    bookmarksGrid,
    gridColumnMeta,
    bookmarkColumnsById,
    linkOptions,
    widgetCallbacks: widgetColumnCallbacks,
    widgetSlots: gridWidgetSlots,
    renderEmpty: renderEmptyGridState,
  });
  gridWidgetSlots = widgetSlots;
  if (rebindInteractions || gridDomChanged || needsGridInteractionRebind(optionsSynced)) {
    attachGridInteractions(bookmarksGrid, optionsSynced);
  }
}

const widgetColumnCallbacks = {
  onSettingsSaved: handleWidgetSettingsSaved,
};

function renderEmptyGridState(): HTMLElement {
  return renderBookmarksGridEmpty(() => settingsModal.open());
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
  const topBarKey = buildTopBarKey(optionsState.topBar, layout);
  if (topBarKey === cachedTopBarKey) return;

  topBarWidgetInstances.forEach((instance) => instance.destroy());
  topBarWidgetInstances = [];
  topBar.replaceChildren();
  cachedTopBarKey = topBarKey;
  searchBarElement = null;

  for (const itemId of topBarItemOrder) {
    if (itemId === 'search') {
      topBar.appendChild(getSearchBarElement());
      continue;
    }
    const meta = topBarWidgetById.get(itemId);
    if (!meta) continue;
    const { element, instance } = renderWidgetColumn(
      meta,
      widgetColumnCallbacks,
      { variant: 'inline' }
    );
    topBar.appendChild(element);
    if (instance) topBarWidgetInstances.push(instance);
  }
}

async function render(scope: RenderScope = 'full'): Promise<void> {
  const generation = ++renderGeneration;
  const app = document.getElementById('app');
  if (!app) return;

  try {
    const tree = await chrome.bookmarks.getTree();
    if (generation !== renderGeneration) return;

    updateBookmarkSearchIndex(tree);

    const skipOptionsFetch = scope === 'bookmarks';
    let storedLayout: LayoutState;
    let optionsSynced: OptionsState;
    let optionsLocal: OptionsLocalState;

    if (skipOptionsFetch) {
      storedLayout = layoutState;
      optionsSynced = optionsState;
      optionsLocal = optionsLocalState;
    } else {
      [storedLayout, optionsSynced, optionsLocal] = await Promise.all([
        getLayout(),
        getOptionsSynced(),
        getOptionsLocal(),
      ]);
    }
    if (generation !== renderGeneration) return;

    if (!skipOptionsFetch) {
      optionsState = optionsSynced;
      optionsLocalState = optionsLocal;
      applyLiveTheme();
      applyCustomCss(optionsLocalState.customCss);
    }

    const baseLayout = layoutDirty ? layoutState : storedLayout;
    let { layout, columns } = reconcileBookmarkColumns(tree, baseLayout);
    const layoutStructureChanged = layout !== baseLayout;

    if (layoutStructureChanged) {
      try {
        await setLayout(layout);
        layoutDirty = false;
      } catch (err) {
        console.error('[new-tab-plus] failed to save layout', err);
        showSaveError('Could not save layout. Check Chrome sync storage space.');
      }
      if (generation !== renderGeneration) return;
    }

    layoutState = layout;

    const bookmarkColumnsById = new Map(columns.map((c) => [c.id, c]));
    const sortedMeta = [...layout.columns].sort((a, b) => a.order - b.order).filter((c) => c.enabled);

    const topBarItemOrder = resolveVisibleTopBarOrder(optionsState.topBar, layout);
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
    if (generation !== renderGeneration) return;

    // Folder toggles during async section loads must not be overwritten by stale layout.
    if (layoutDirty) {
      layout = { ...layout, folderState: { ...layout.folderState, ...layoutState.folderState } };
      layoutState = { ...layoutState, folderState: layout.folderState };
      try {
        await setLayout(layout);
        layoutDirty = false;
      } catch (err) {
        console.error('[new-tab-plus] failed to save layout', err);
        showSaveError('Could not save layout changes. Check Chrome sync storage space.');
      }
      if (generation !== renderGeneration) return;
    }

    clearRenderError();

    const specialSectionsById = new Map(specialSectionVms.map((vm) => [vm.id, vm]));
    const linkOptions = {
      openLinksInSameTab: optionsState.general.openLinksInSameTab,
      rememberOpenFolders: optionsState.general.rememberOpenFolders,
      lockColumns: optionsState.general.lockColumns,
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
        optionsState,
        false
      );
      return;
    }

    const topBarKey = buildTopBarKey(optionsState.topBar, layout);
    const rebuildTopBar = topBarKey !== cachedTopBarKey;

    if (rebuildTopBar) {
      renderTopBar(topBar, layout, topBarItemOrder);
    }

    refreshGrid(
      bookmarksGrid,
      gridColumnMeta,
      bookmarkColumnsById,
      linkOptions,
      optionsState,
      false
    );
  } catch (err) {
    console.error('[new-tab-plus] render failed', err);
    showRenderError('Something went wrong loading your new tab. Please try again.');
  }
}

async function persistLayout(): Promise<void> {
  try {
    await setLayout(layoutState);
    layoutDirty = false;
  } catch (err) {
    console.error('[new-tab-plus] failed to save layout', err);
    showSaveError('Could not save layout. Check Chrome sync storage space.');
    throw new LayoutPersistError(err);
  }
}

async function persistLayoutAndRender(): Promise<void> {
  layoutUpdateChain = layoutUpdateChain
    .then(async () => {
      await persistLayout();
      await render();
    })
    .catch((err) => {
      console.error('[new-tab-plus] layout update failed', err);
      if (!(err instanceof LayoutPersistError)) {
        showSaveError('Could not save layout. Check Chrome sync storage space.');
      }
    });
  return layoutUpdateChain;
}

function setFolderCollapsed(folderId: string, collapsed: boolean): void {
  layoutState.folderState[folderId] = { collapsed };
  markLayoutDirty();
  layoutUpdateChain = layoutUpdateChain
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

function reorderLayoutColumns(movedColumnId: string, beforeColumnId: string | null): void {
  markLayoutDirty();
  const sorted = [...layoutState.columns].sort((a, b) => a.order - b.order);
  const orderedIds = reorderIds(
    sorted.map((c) => c.id),
    movedColumnId,
    beforeColumnId
  );
  const byId = new Map(sorted.map((c) => [c.id, c]));

  orderedIds.forEach((id, i) => {
    const column = byId.get(id);
    if (column) column.order = i;
  });

  layoutState.columns = orderedIds.map((id) => byId.get(id)!);
}

async function handleStackKeyboardMove(
  folderId: string,
  sourceGridColumnId: string,
  direction: StackMoveDirection
): Promise<void> {
  if (optionsState.general.lockColumns) return;

  const gridCols = layoutState.columns.filter(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid'
  );
  const action = resolveStackKeyboardMove(gridCols, folderId, sourceGridColumnId, direction);

  switch (action.type) {
    case 'noop':
      return;
    case 'reorder-in-column': {
      const col = layoutState.columns.find(
        (c): c is BookmarkGridColumnMeta =>
          c.type === 'bookmarkGrid' && c.id === action.gridColumnId
      );
      if (!col) return;
      setColumnStack(col, reorderIds(getColumnStack(col), action.folderId, action.beforeFolderId));
      markLayoutDirty();
      await persistLayoutAndRender();
      return;
    }
    case 'move-column':
      await handleGridFolderNewColumn(action.folderId, action.sourceGridColumnId, action.beforeColumnId);
      return;
    case 'move-to-column': {
      const targetCol = layoutState.columns.find(
        (c): c is BookmarkGridColumnMeta =>
          c.type === 'bookmarkGrid' && c.id === action.targetGridColumnId
      );
      if (!targetCol) return;
      const targetStack = getColumnStack(targetCol);
      const lastId = targetStack[targetStack.length - 1] ?? null;
      if (lastId) {
        await handleGridFolderIntoColumn(
          action.folderId,
          action.sourceGridColumnId,
          action.targetGridColumnId,
          lastId,
          'after'
        );
      } else {
        await handleGridFolderIntoColumn(
          action.folderId,
          action.sourceGridColumnId,
          action.targetGridColumnId,
          null,
          'before'
        );
      }
    }
  }
}

async function handleGridFolderDrop(
  folderId: string,
  sourceGridColumnId: string,
  target: GridFolderDropResult
): Promise<void> {
  if (target.mode === 'newColumn') {
    await handleGridFolderNewColumn(folderId, sourceGridColumnId, target.beforeColumnId);
    return;
  }
  await handleGridFolderIntoColumn(
    folderId,
    sourceGridColumnId,
    target.gridColumnId,
    target.targetFolderId,
    target.position
  );
}

async function handleGridFolderIntoColumn(
  folderId: string,
  sourceGridColumnId: string,
  targetGridColumnId: string,
  targetFolderId: string | null,
  position: 'before' | 'after'
): Promise<void> {
  dndLog('handleGridFolderIntoColumn', {
    folderId,
    sourceGridColumnId,
    targetGridColumnId,
    targetFolderId,
    position,
  });

  const sourceCol = layoutState.columns.find(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid' && c.id === sourceGridColumnId
  );
  const targetCol = layoutState.columns.find(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid' && c.id === targetGridColumnId
  );
  if (!sourceCol || !targetCol) {
    dndWarn('handleGridFolderIntoColumn aborted: grid column not found', {
      sourceGridColumnId,
      targetGridColumnId,
    });
    return;
  }

  markLayoutDirty();
  let targetStack = [...getColumnStack(targetCol)];
  if (sourceGridColumnId === targetGridColumnId) {
    targetStack = targetStack.filter((id) => id !== folderId);
  } else {
    setColumnStack(sourceCol, getColumnStack(sourceCol).filter((id) => id !== folderId));
  }

  let beforeFolderId: string | null = null;
  if (targetFolderId === null) {
    beforeFolderId = null;
  } else if (position === 'before') {
    beforeFolderId = targetFolderId;
  } else {
    const idx = targetStack.indexOf(targetFolderId);
    beforeFolderId = idx === -1 ? null : (targetStack[idx + 1] ?? null);
  }

  setColumnStack(targetCol, reorderIds(targetStack, folderId, beforeFolderId));

  dndLog('handleGridFolderIntoColumn result', {
    folderId,
    targetGridColumnId: targetCol.id,
    stack: getColumnStack(targetCol),
  });

  layoutState.columns = layoutState.columns.filter(
    (c) => c.type !== 'bookmarkGrid' || getColumnStack(c).length > 0
  );

  await persistLayoutAndRender();
}

async function handleGridFolderNewColumn(
  folderId: string,
  sourceGridColumnId: string,
  beforeColumnId: string | null
): Promise<void> {
  dndLog('handleGridFolderNewColumn', { folderId, sourceGridColumnId, beforeColumnId });

  const sourceCol = layoutState.columns.find(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid' && c.id === sourceGridColumnId
  );
  if (!sourceCol) {
    dndWarn('handleGridFolderNewColumn aborted: source column not found', { sourceGridColumnId });
    return;
  }

  markLayoutDirty();
  const sourceStack = getColumnStack(sourceCol);
  const newColId = gridColumnIdForFolder(folderId);
  const isSoloColumnMove =
    sourceGridColumnId === newColId && sourceStack.length === 1 && sourceStack[0] === folderId;

  if (isSoloColumnMove) {
    reorderLayoutColumns(newColId, beforeColumnId);
    dndLog('handleGridFolderNewColumn result (solo reorder)', {
      folderId,
      newColId,
      beforeColumnId,
    });
    await persistLayoutAndRender();
    return;
  }

  setColumnStack(sourceCol, sourceStack.filter((id) => id !== folderId));

  const gridCols = layoutState.columns.filter(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid'
  );
  const takenColumnIds = collectGridColumnIds(gridCols);
  reIdSourceColumnAfterNamesakeSplit(sourceCol, folderId, takenColumnIds);

  layoutState.columns = layoutState.columns.filter(
    (c) => c.type !== 'bookmarkGrid' || getColumnStack(c).length > 0
  );

  let newCol = layoutState.columns.find(
    (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid' && c.id === newColId
  );
  if (!newCol) {
    const maxOrder = layoutState.columns.reduce((max, c) => Math.max(max, c.order), -1);
    newCol = {
      id: newColId,
      type: 'bookmarkGrid',
      order: maxOrder + 1,
      enabled: true,
      stack: [folderId],
    };
    layoutState.columns.push(newCol);
  } else {
    setColumnStack(
      newCol,
      reorderIds(
        getColumnStack(newCol).filter((id) => id !== folderId),
        folderId,
        null
      )
    );
  }

  reorderLayoutColumns(newColId, beforeColumnId);

  dndLog('handleGridFolderNewColumn result', {
    folderId,
    newColId,
    beforeColumnId,
    stack: getColumnStack(newCol),
    allGridColumns: layoutState.columns
      .filter((c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid')
      .map((c) => ({ id: c.id, stack: getColumnStack(c) })),
  });

  await persistLayoutAndRender();
}

function mergeWidgetSettings(meta: WidgetColumnMeta, partial: Record<string, unknown>): void {
  if (!meta.settings || typeof meta.settings !== 'object') {
    meta.settings = {};
  }
  Object.assign(meta.settings, partial);
}

function invalidateTopBarCacheIfNeeded(widgetId: string): void {
  if (isTopBarWidget(widgetId)) {
    cachedTopBarKey = '';
  }
}

function saveWidgetSettings(widgetId: string, partial: Record<string, unknown>): void {
  const meta = layoutState.columns.find(
    (c): c is WidgetColumnMeta => c.type === 'widget' && c.widgetId === widgetId
  );
  if (!meta) return;
  mergeWidgetSettings(meta, partial);
  invalidateTopBarCacheIfNeeded(meta.widgetId);
  if (isTopBarWidget(meta.widgetId)) {
    const topBar = document.querySelector<HTMLElement>('.top-bar');
    if (topBar) {
      renderTopBar(topBar, layoutState, resolveVisibleTopBarOrder(optionsState.topBar, layoutState));
    }
  }
  markLayoutDirty();
  pendingWidgetSettingsSaves.add(widgetId);
  window.clearTimeout(saveWidgetSettingsTimer);
  saveWidgetSettingsTimer = window.setTimeout(() => {
    void persistPendingWidgetSettings();
  }, 200);
}

let saveWidgetSettingsTimer: number | undefined;
const pendingWidgetSettingsSaves = new Set<string>();
let focusRefreshTimer: number | undefined;

async function persistPendingWidgetSettings(): Promise<void> {
  const widgetIds = [...pendingWidgetSettingsSaves];
  pendingWidgetSettingsSaves.clear();
  if (widgetIds.length === 0) return;

  try {
    await persistLayout();
    for (const widgetId of widgetIds) {
      refreshWidgetUiAfterSettingsSave(widgetId);
    }
  } catch (err) {
    console.error('[new-tab-plus] failed to save widget settings', err);
    if (!(err instanceof LayoutPersistError)) {
      showSaveError('Could not save widget settings.');
    }
  }
}

function refreshWidgetUiAfterSettingsSave(widgetId: string): void {
  const meta = layoutState.columns.find(
    (c): c is WidgetColumnMeta => c.type === 'widget' && c.widgetId === widgetId
  );
  if (!meta) return;

  if (isTopBarWidget(meta.widgetId)) {
    const topBar = document.querySelector<HTMLElement>('.top-bar');
    if (topBar) {
      renderTopBar(topBar, layoutState, resolveVisibleTopBarOrder(optionsState.topBar, layoutState));
    }
    return;
  }

  const slot = gridWidgetSlots.get(meta.instanceId);
  if (slot) {
    slot.instance.destroy();
    gridWidgetSlots.delete(meta.instanceId);
    scheduleRender('bookmarks');
  }
}

async function flushPendingSavesAsync(): Promise<void> {
  window.clearTimeout(saveLayoutTimer);
  window.clearTimeout(saveOptionsTimer);
  window.clearTimeout(saveOptionsLocalTimer);
  window.clearTimeout(saveWidgetSettingsTimer);

  const widgetIds = [...pendingWidgetSettingsSaves];
  pendingWidgetSettingsSaves.clear();

  const needsLayoutPersist = layoutDirty || widgetIds.length > 0;
  const saves: Promise<void>[] = [];
  if (needsLayoutPersist) {
    saves.push(persistLayout());
  }
  saves.push(
    setOptionsSynced(optionsState).catch((err) => {
      console.error('[new-tab-plus] failed to save options', err);
      showSaveError('Could not save settings. Check Chrome sync storage space.');
    }),
    setOptionsLocal(optionsLocalState).catch((err) => {
      console.error('[new-tab-plus] failed to save local options', err);
      showSaveError('Could not save local settings.');
    })
  );
  await Promise.all(saves);

  for (const widgetId of widgetIds) {
    refreshWidgetUiAfterSettingsSave(widgetId);
  }
}

function flushPendingSaves(): void {
  void flushPendingSavesAsync();
}

async function handleWidgetSettingsSaved(instanceId: string, partial: Record<string, unknown>): Promise<boolean> {
  const meta = layoutState.columns.find(
    (c): c is WidgetColumnMeta => c.type === 'widget' && c.instanceId === instanceId
  );
  if (!meta) return true;
  mergeWidgetSettings(meta, partial);
  invalidateTopBarCacheIfNeeded(meta.widgetId);
  markLayoutDirty();

  try {
    await persistLayout();

    if (isTopBarWidget(meta.widgetId)) {
      const topBar = document.querySelector<HTMLElement>('.top-bar');
      if (topBar) {
        renderTopBar(topBar, layoutState, resolveVisibleTopBarOrder(optionsState.topBar, layoutState));
      }
      return true;
    }

    const slot = gridWidgetSlots.get(instanceId);
    if (slot) {
      slot.instance.destroy();
      gridWidgetSlots.delete(instanceId);
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

// --- settings modal wiring -------------------------------------------------
// Layout-affecting changes (sections, widgets) persist then re-render the
// real grid; theme/CSS changes apply directly to the live document with no
// storage round-trip needed, so they feel instant.

let saveLayoutTimer: number | undefined;
function saveLayout(): void {
  markLayoutDirty();
  window.clearTimeout(saveLayoutTimer);
  saveLayoutTimer = window.setTimeout(() => void persistAndRenderLayout(), 200);
}

function saveLayoutNow(): void {
  markLayoutDirty();
  window.clearTimeout(saveLayoutTimer);
  void persistAndRenderLayout();
}

async function persistAndRenderLayout(): Promise<void> {
  await persistLayoutAndRender();
}

let saveOptionsTimer: number | undefined;
function saveOptions(): void {
  applyLiveTheme();
  window.clearTimeout(saveOptionsTimer);
  saveOptionsTimer = window.setTimeout(() => {
    void setOptionsSynced(optionsState).catch((err) => {
      console.error('[new-tab-plus] failed to save options', err);
      showSaveError('Could not save settings. Check Chrome sync storage space.');
    });
  }, 200);
}

function saveOptionsNow(): void {
  applyLiveTheme();
  window.clearTimeout(saveOptionsTimer);
  void setOptionsSynced(optionsState).catch((err) => {
    console.error('[new-tab-plus] failed to save options', err);
    showSaveError('Could not save settings. Check Chrome sync storage space.');
  });
}

let saveOptionsLocalTimer: number | undefined;
function saveOptionsLocal(): void {
  if (validateCustomCss(optionsLocalState.customCss).ok) {
    applyCustomCss(optionsLocalState.customCss);
  }
  window.clearTimeout(saveOptionsLocalTimer);
  saveOptionsLocalTimer = window.setTimeout(() => {
    void setOptionsLocal(optionsLocalState).catch((err) => {
      console.error('[new-tab-plus] failed to save local options', err);
      showSaveError('Could not save local settings.');
    });
  }, 200);
}

function setLayoutDirect(newLayout: LayoutState): void {
  layoutState = newLayout;
  markLayoutDirty();
  void persistAndRenderLayout();
}

function setOptionsDirect(newOptions: OptionsState): void {
  const previous = optionsState;
  optionsState = mergeOptionsState(newOptions);
  applyLiveTheme();
  void setOptionsSynced(optionsState).catch((err) => {
    console.error('[new-tab-plus] failed to save options', err);
    showSaveError('Could not save settings. Check Chrome sync storage space.');
  });
  handleRemoteOptionsChange(previous);
}

function setOptionsLocalDirect(newOptionsLocal: OptionsLocalState): void {
  optionsLocalState = {
    ...optionsLocalState,
    ...newOptionsLocal,
    customCss: newOptionsLocal.customCss,
    dismissedUpdateVersion: newOptionsLocal.dismissedUpdateVersion,
  };
  applyCustomCss(optionsLocalState.customCss);
  void setOptionsLocal(optionsLocalState).catch((err) => {
    console.error('[new-tab-plus] failed to save local options', err);
    showSaveError('Could not save local settings.');
  });
}

async function resetBookmarkLayout(): Promise<void> {
  const tree = await chrome.bookmarks.getTree();
  layoutState = resetBookmarkGridLayout(layoutState, tree);
  markLayoutDirty();
  await persistLayoutAndRender();
}

const updateCheckContext = {
  getCheckEnabled: () => optionsState.general.checkForUpdates,
  getDismissedVersion: () => optionsLocalState.dismissedUpdateVersion,
  setDismissedVersion: async (version: string) => {
    optionsLocalState = { ...optionsLocalState, dismissedUpdateVersion: version };
    await setOptionsLocal(optionsLocalState);
  },
};

initUpdateChecker(updateCheckContext);

const settingsDeps: SettingsDeps = {
  get layout() {
    return layoutState;
  },
  get options() {
    return optionsState;
  },
  get optionsLocal() {
    return optionsLocalState;
  },
  saveLayout,
  saveLayoutNow,
  saveOptions,
  saveOptionsNow,
  saveOptionsLocal,
  refreshPanel: () => {},
  rerenderPage: () => {
    cachedTopBarKey = '';
    scheduleRender();
  },
  rebindGridInteractions,
  saveWidgetSettings,
  setLayoutDirect,
  setOptionsDirect,
  setOptionsLocalDirect,
  resetBookmarkLayout: () => {
    void resetBookmarkLayout();
  },
  flushPendingSaves,
  onCheckForUpdatesChange: (enabled) => {
    if (enabled) {
      void runUpdateCheck(updateCheckContext, { force: true });
      return;
    }
    hideUpdateBanner();
  },
};

const settingsModal = createSettingsModal(settingsDeps);
document.body.appendChild(settingsModal.element);
document.body.appendChild(renderSettingsButton(() => settingsModal.toggle()));

const commandPalette = attachCommandPalette({
  getBookmarkEntries: () => bookmarkSearchEntries,
  openUrl: (url) => navigateExternalUrl(url, optionsState.general.openLinksInSameTab),
  searchWeb: (query) => {
    openWebSearch(optionsState.topBar.searchEngine, query);
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
    flushPendingSaves();
    return;
  }
  invalidateSpecialSectionCache('mostVisited');
  window.clearTimeout(focusRefreshTimer);
  focusRefreshTimer = window.setTimeout(() => scheduleRender('bookmarks'), 300);
});

const appRoot = document.getElementById('app');
if (appRoot) attachNonSelectableLabels(appRoot);

void (async () => {
  try {
    const [layout, synced, local] = await Promise.all([getLayout(), getOptionsSynced(), getOptionsLocal()]);
    layoutState = layout;
    optionsState = synced;
    optionsLocalState = local;
    applyLiveTheme();
    applyCustomCss(local.customCss);
    await render('full');
    void runUpdateCheck(updateCheckContext);
  } catch (err) {
    console.error('[new-tab-plus] initial render failed', err);
    showRenderError('Something went wrong loading your new tab. Please try again.');
  }
})();
