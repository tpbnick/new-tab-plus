import {
  SCHEMA_VERSION,
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
  mergeOptionsState,
  type LayoutState,
  type OptionsLocalState,
  type OptionsState,
} from './schema';
import { runMigrations } from './migrations';
import { coerceLayoutState, isLayoutNormalized, normalizeLayoutColumns } from './layoutNormalize';
import { clampSearchMaxWidthPx, normalizeTopBarItemOrder } from '../topBar/topBarLayout';

const KEYS = {
  layout: 'layout',
  options: 'options',
  optionsLocal: 'optionsLocal',
} as const;

/** Recent writes from this tab — onChanged can arrive after set() resolves. */
const recentSelfWrites = new Map<string, number>();
const SELF_WRITE_TTL_MS = 750;

function storageKey(areaName: 'sync' | 'local', key: string): string {
  return `${areaName}:${key}`;
}

export function isSelfStorageWrite(areaName: 'sync' | 'local', key: string): boolean {
  const id = storageKey(areaName, key);
  const writtenAt = recentSelfWrites.get(id);
  if (writtenAt === undefined) return false;
  if (Date.now() - writtenAt > SELF_WRITE_TTL_MS) {
    recentSelfWrites.delete(id);
    return false;
  }
  return true;
}

async function writeTo<T>(area: chrome.storage.StorageArea, key: string, value: T): Promise<void> {
  const areaName = area === chrome.storage.sync ? 'sync' : 'local';
  recentSelfWrites.set(storageKey(areaName, key), Date.now());
  await area.set({ [key]: value });
}

function loadLayoutFromRaw(raw: unknown): LayoutState {
  const coerced = coerceLayoutState(raw);
  const migrated = runMigrations(coerced, SCHEMA_VERSION) as LayoutState;
  return normalizeLayoutColumns(coerceLayoutState(migrated));
}

function layoutNeedsPersist(raw: unknown, sanitized: LayoutState): boolean {
  if (!raw || typeof raw !== 'object') return true;
  const version = (raw as Partial<LayoutState>).schemaVersion ?? 0;
  if (version < SCHEMA_VERSION) return true;
  return !isLayoutNormalized(sanitized);
}

export function readSyncBookmarkLayoutEnabledFromOptions(options: OptionsState): boolean {
  return options.general.syncBookmarkLayout !== false;
}

export async function readSyncBookmarkLayoutEnabled(): Promise<boolean> {
  const result = await chrome.storage.sync.get(KEYS.options);
  const raw = result[KEYS.options];
  if (!raw || typeof raw !== 'object') return true;
  return readSyncBookmarkLayoutEnabledFromOptions(mergeOptionsState(raw as Partial<OptionsState>));
}

function layoutStorageArea(syncEnabled: boolean): chrome.storage.StorageArea {
  return syncEnabled ? chrome.storage.sync : chrome.storage.local;
}

async function readLayoutFromArea(area: chrome.storage.StorageArea): Promise<LayoutState | undefined> {
  const result = await area.get(KEYS.layout);
  const raw = result[KEYS.layout];
  if (raw === undefined) return undefined;
  return loadLayoutFromRaw(raw);
}

export type LayoutStorageSource = 'sync' | 'local' | 'default';

export interface LayoutLoadResult {
  layout: LayoutState;
  source: LayoutStorageSource;
  /** False when no layout existed in either storage area (implicit default only). */
  hadStoredLayout: boolean;
}

export async function loadLayout(options?: OptionsState): Promise<LayoutLoadResult> {
  const useSync = options
    ? readSyncBookmarkLayoutEnabledFromOptions(options)
    : await readSyncBookmarkLayoutEnabled();
  const primaryArea = layoutStorageArea(useSync);
  const primarySource: LayoutStorageSource = useSync ? 'sync' : 'local';
  const result = await primaryArea.get(KEYS.layout);
  const raw = result[KEYS.layout];

  if (raw !== undefined) {
    const sanitized = loadLayoutFromRaw(raw);
    if (layoutNeedsPersist(raw, sanitized)) {
      void writeTo(primaryArea, KEYS.layout, sanitized);
    }
    return { layout: sanitized, source: primarySource, hadStoredLayout: true };
  }

  const fallbackArea = layoutStorageArea(!useSync);
  const fallback = await readLayoutFromArea(fallbackArea);
  if (fallback) {
    void writeTo(primaryArea, KEYS.layout, fallback);
    return { layout: fallback, source: primarySource, hadStoredLayout: true };
  }

  return {
    layout: createDefaultLayoutState(),
    source: 'default',
    hadStoredLayout: false,
  };
}

export async function getLayout(options?: OptionsState): Promise<LayoutState> {
  const { layout } = await loadLayout(options);
  return layout;
}

export async function setLayout(state: LayoutState, options?: OptionsState): Promise<void> {
  const useSync = options
    ? readSyncBookmarkLayoutEnabledFromOptions(options)
    : await readSyncBookmarkLayoutEnabled();
  return writeTo(layoutStorageArea(useSync), KEYS.layout, loadLayoutFromRaw(state));
}

/** Copy the current layout into the storage area that will be used after toggling sync. */
export async function migrateLayoutStorage(
  enableSync: boolean,
  currentLayout: LayoutState
): Promise<void> {
  const sanitized = loadLayoutFromRaw(currentLayout);
  await writeTo(layoutStorageArea(enableSync), KEYS.layout, sanitized);
}

function normalizeOptions(state: OptionsState): OptionsState {
  return {
    ...state,
    topBar: {
      ...state.topBar,
      searchMaxWidthPx: clampSearchMaxWidthPx(state.topBar.searchMaxWidthPx),
    },
  };
}

export async function getOptionsSynced(): Promise<OptionsState> {
  const result = await chrome.storage.sync.get(KEYS.options);
  const raw = result[KEYS.options];
  if (raw === undefined) {
    return createDefaultOptionsState();
  }
  return normalizeOptions(mergeOptionsState(raw as Partial<OptionsState>));
}

export async function setOptionsSynced(state: OptionsState): Promise<void> {
  return writeTo(chrome.storage.sync, KEYS.options, normalizeOptions(state));
}

export async function getOptionsLocal(): Promise<OptionsLocalState> {
  const result = await chrome.storage.local.get(KEYS.optionsLocal);
  const raw = result[KEYS.optionsLocal];
  if (raw === undefined) {
    return createDefaultOptionsLocalState();
  }
  const defaults = createDefaultOptionsLocalState();
  const partial = raw as Partial<OptionsLocalState>;
  return {
    ...defaults,
    ...partial,
    schemaVersion:
      typeof partial.schemaVersion === 'number' ? partial.schemaVersion : defaults.schemaVersion,
    customCss: typeof partial.customCss === 'string' ? partial.customCss : defaults.customCss,
    dismissedUpdateVersion:
      typeof partial.dismissedUpdateVersion === 'string'
        ? partial.dismissedUpdateVersion
        : defaults.dismissedUpdateVersion,
  };
}

export async function setOptionsLocal(state: OptionsLocalState): Promise<void> {
  return writeTo(chrome.storage.local, KEYS.optionsLocal, state);
}

/** True when expand-on-hover and/or lock-columns changed. */
export function optionsGridInteractionsChanged(before: OptionsState, after: OptionsState): boolean {
  return (
    before.general.expandCollapsedOnHover !== after.general.expandCollapsedOnHover ||
    before.general.lockColumns !== after.general.lockColumns
  );
}

/** True when only grid interaction options changed (rebind / bookmark refresh, no full layout rebuild). */
export function optionsOnlyGridInteractionsChanged(before: OptionsState, after: OptionsState): boolean {
  if (optionsAffectLayout(before, after)) return false;
  return optionsGridInteractionsChanged(before, after);
}

/** @deprecated Use optionsOnlyGridInteractionsChanged — kept for call-site clarity where only hover matters. */
export function optionsOnlyExpandHoverChanged(before: OptionsState, after: OptionsState): boolean {
  if (before.general.expandCollapsedOnHover === after.general.expandCollapsedOnHover) return false;
  return (
    before.general.lockColumns === after.general.lockColumns &&
    before.general.rememberOpenFolders === after.general.rememberOpenFolders &&
    before.general.openLinksInSameTab === after.general.openLinksInSameTab &&
    before.topBar.searchEnabled === after.topBar.searchEnabled &&
    before.topBar.searchEngine === after.topBar.searchEngine &&
    JSON.stringify(normalizeTopBarItemOrder(before.topBar.itemOrder)) ===
      JSON.stringify(normalizeTopBarItemOrder(after.topBar.itemOrder))
  );
}

/** True when synced options changes require rebuilding the page layout. */
export function optionsAffectLayout(before: OptionsState, after: OptionsState): boolean {
  return (
    before.general.rememberOpenFolders !== after.general.rememberOpenFolders ||
    before.general.openLinksInSameTab !== after.general.openLinksInSameTab ||
    before.topBar.searchEnabled !== after.topBar.searchEnabled ||
    JSON.stringify(normalizeTopBarItemOrder(before.topBar.itemOrder)) !==
      JSON.stringify(normalizeTopBarItemOrder(after.topBar.itemOrder))
  );
}
