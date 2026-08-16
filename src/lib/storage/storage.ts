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
import { clampTopBarOptions, normalizeTopBarItemOrder } from '../topBar/topBarLayout';
import { showSaveError } from '../ui/saveErrorBanner';

const KEYS = {
  layout: 'layout',
  folderState: 'folderState',
  options: 'options',
  optionsLocal: 'optionsLocal',
} as const;

/** Chrome sync QUOTA_BYTES_PER_ITEM is 8192; leave a small margin for the key name. */
export const SYNC_ITEM_MAX_BYTES = 8000;

/** Recent writes from this tab — onChanged can arrive after set() resolves. */
const recentSelfWrites = new Map<string, number>();
const SELF_WRITE_TTL_MS = 750;

let resolvedSyncToCloud: boolean | undefined;
let lastOptionsPersistKey = '';
let lastOptionsLocalPersistJson = '';

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

/** Test-only: clear area preference and self-write marks. */
export function resetStorageStateForTests(): void {
  resolvedSyncToCloud = undefined;
  lastOptionsPersistKey = '';
  lastOptionsLocalPersistJson = '';
  recentSelfWrites.clear();
}

export function storageValueByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function assertSyncItemFits(key: string, value: unknown): void {
  const bytes = storageValueByteLength(value);
  if (bytes > SYNC_ITEM_MAX_BYTES) {
    throw new Error(
      `Chrome sync item "${key}" is ${bytes} bytes (limit ${SYNC_ITEM_MAX_BYTES}).`
    );
  }
}

async function writeTo<T>(area: chrome.storage.StorageArea, key: string, value: T): Promise<void> {
  const areaName = area === chrome.storage.sync ? 'sync' : 'local';
  recentSelfWrites.set(storageKey(areaName, key), Date.now());
  await area.set({ [key]: value });
}

export function migrateAndNormalizeLayout(raw: unknown): LayoutState {
  const coerced = coerceLayoutState(raw);
  const migrated = runMigrations(coerced, SCHEMA_VERSION) as LayoutState;
  return normalizeLayoutColumns(coerceLayoutState(migrated));
}

function layoutRecord(state: LayoutState): Pick<LayoutState, 'schemaVersion' | 'columns'> {
  return { schemaVersion: state.schemaVersion, columns: state.columns };
}

function assembleLayoutRaw(layoutRaw: unknown, folderRaw: unknown): unknown {
  if (layoutRaw === undefined) return undefined;
  if (!layoutRaw || typeof layoutRaw !== 'object') return layoutRaw;
  const embedded = (layoutRaw as Partial<LayoutState>).folderState;
  const folderState =
    folderRaw && typeof folderRaw === 'object' && !Array.isArray(folderRaw) ? folderRaw : embedded;
  return { ...(layoutRaw as object), folderState: folderState ?? {} };
}

async function readLayoutRaw(area: chrome.storage.StorageArea): Promise<unknown> {
  const result = await area.get([KEYS.layout, KEYS.folderState]);
  return assembleLayoutRaw(result[KEYS.layout], result[KEYS.folderState]);
}

async function writeLayout(area: chrome.storage.StorageArea, sanitized: LayoutState): Promise<void> {
  const areaName = area === chrome.storage.sync ? 'sync' : 'local';
  const record = layoutRecord(sanitized);
  if (areaName === 'sync') {
    assertSyncItemFits(KEYS.layout, record);
    assertSyncItemFits(KEYS.folderState, sanitized.folderState);
  }
  recentSelfWrites.set(storageKey(areaName, KEYS.layout), Date.now());
  recentSelfWrites.set(storageKey(areaName, KEYS.folderState), Date.now());
  await area.set({
    [KEYS.layout]: record,
    [KEYS.folderState]: sanitized.folderState,
  });
}

function layoutNeedsPersist(raw: unknown, sanitized: LayoutState): boolean {
  if (!raw || typeof raw !== 'object') return true;
  const version = (raw as Partial<LayoutState>).schemaVersion ?? 0;
  if (version < SCHEMA_VERSION) return true;
  return !isLayoutNormalized(sanitized);
}

async function detectLegacyCloudData(): Promise<boolean> {
  const sync = await chrome.storage.sync.get([KEYS.layout, KEYS.options]);
  if (sync[KEYS.options] && typeof sync[KEYS.options] === 'object') {
    const merged = mergeOptionsState(sync[KEYS.options] as Partial<OptionsState>);
    if (merged.general.syncBookmarkLayout === false) return false;
  }
  return sync[KEYS.layout] !== undefined || sync[KEYS.options] !== undefined;
}

async function ensureSyncToCloud(): Promise<boolean> {
  if (typeof resolvedSyncToCloud === 'boolean') return resolvedSyncToCloud;

  const result = await chrome.storage.local.get(KEYS.optionsLocal);
  const raw = result[KEYS.optionsLocal] as Partial<OptionsLocalState> | undefined;
  if (typeof raw?.syncToCloud === 'boolean') {
    resolvedSyncToCloud = raw.syncToCloud;
    return resolvedSyncToCloud;
  }

  resolvedSyncToCloud = await detectLegacyCloudData();
  return resolvedSyncToCloud;
}

/** Drop data: background URLs — they are too large for Chrome sync and stay local. */
export function optionsForCloud(state: OptionsState): OptionsState {
  const url = state.background.imageUrl.trim();
  if (url.startsWith('data:')) {
    return { ...state, background: { ...state.background, imageUrl: '' } };
  }
  return state;
}

function mergeCloudAndLocalOptions(cloudRaw: unknown, localRaw: unknown): OptionsState {
  const primary = cloudRaw ?? localRaw;
  if (primary === undefined) return createDefaultOptionsState();
  const merged = normalizeOptions(mergeOptionsState(primary as Partial<OptionsState>));
  if (localRaw && typeof localRaw === 'object') {
    const localUrl = (localRaw as Partial<OptionsState>).background?.imageUrl ?? '';
    if (localUrl.startsWith('data:') && !merged.background.imageUrl.startsWith('data:')) {
      merged.background.imageUrl = localUrl;
    }
  }
  return merged;
}

export type LayoutStorageSource = 'sync' | 'local' | 'default';

export interface LayoutLoadResult {
  layout: LayoutState;
  source: LayoutStorageSource;
  /** False when no layout existed in either storage area (implicit default only). */
  hadStoredLayout: boolean;
}

export async function loadLayout(): Promise<LayoutLoadResult> {
  const useSync = await ensureSyncToCloud();
  const primary = useSync ? chrome.storage.sync : chrome.storage.local;
  const fallback = useSync ? chrome.storage.local : chrome.storage.sync;
  const primarySource: LayoutStorageSource = useSync ? 'sync' : 'local';
  let raw = await readLayoutRaw(primary);
  if (raw === undefined) {
    raw = await readLayoutRaw(fallback);
    if (raw !== undefined) {
      const sanitized = migrateAndNormalizeLayout(raw);
      try {
        await writeLayout(primary, sanitized);
      } catch (err) {
        console.error('[new-tab-plus] failed to copy layout into the active storage area', err);
        showSaveError('Could not save layout. Check Chrome sync storage space.');
      }
      return { layout: sanitized, source: primarySource, hadStoredLayout: true };
    }
    return {
      layout: createDefaultLayoutState(),
      source: 'default',
      hadStoredLayout: false,
    };
  }

  const sanitized = migrateAndNormalizeLayout(raw);
  if (layoutNeedsPersist(raw, sanitized)) {
    try {
      await writeLayout(primary, sanitized);
    } catch (err) {
      console.error('[new-tab-plus] failed to persist migrated layout', err);
      showSaveError('Could not save an upgraded layout. Check Chrome sync storage space.');
    }
  }
  return { layout: sanitized, source: primarySource, hadStoredLayout: true };
}

export async function getLayout(): Promise<LayoutState> {
  const { layout } = await loadLayout();
  return layout;
}

export async function setLayout(state: LayoutState): Promise<LayoutState> {
  const sanitized = migrateAndNormalizeLayout(state);
  const useSync = await ensureSyncToCloud();
  await writeLayout(useSync ? chrome.storage.sync : chrome.storage.local, sanitized);
  return sanitized;
}

function normalizeOptions(state: OptionsState): OptionsState {
  return {
    ...state,
    topBar: clampTopBarOptions(state.topBar),
  };
}

function optionsPersistKey(state: OptionsState, cloud: boolean): string {
  return `${cloud ? '1' : '0'}:${JSON.stringify(state)}`;
}

export async function getOptionsSynced(): Promise<OptionsState> {
  const useSync = await ensureSyncToCloud();
  const localRaw = (await chrome.storage.local.get(KEYS.options))[KEYS.options];
  let resolved: OptionsState;
  if (!useSync) {
    if (localRaw === undefined) {
      const cloudRaw = (await chrome.storage.sync.get(KEYS.options))[KEYS.options];
      if (cloudRaw === undefined) {
        resolved = createDefaultOptionsState();
      } else {
        resolved = normalizeOptions(mergeOptionsState(cloudRaw as Partial<OptionsState>));
      }
    } else {
      resolved = normalizeOptions(mergeOptionsState(localRaw as Partial<OptionsState>));
    }
  } else {
    const cloudRaw = (await chrome.storage.sync.get(KEYS.options))[KEYS.options];
    resolved = mergeCloudAndLocalOptions(cloudRaw, localRaw);
  }
  lastOptionsPersistKey = optionsPersistKey(resolved, useSync);
  return resolved;
}

export async function setOptionsSynced(state: OptionsState): Promise<void> {
  const normalized = normalizeOptions(state);
  const useSync = await ensureSyncToCloud();
  const persistKey = optionsPersistKey(normalized, useSync);
  if (persistKey === lastOptionsPersistKey) return;
  if (useSync) {
    assertSyncItemFits(KEYS.options, optionsForCloud(normalized));
  }
  await writeTo(chrome.storage.local, KEYS.options, normalized);
  if (useSync) {
    await writeTo(chrome.storage.sync, KEYS.options, optionsForCloud(normalized));
  }
  lastOptionsPersistKey = persistKey;
}

export async function getOptionsLocal(): Promise<OptionsLocalState> {
  const result = await chrome.storage.local.get(KEYS.optionsLocal);
  const raw = result[KEYS.optionsLocal];
  const defaults = createDefaultOptionsLocalState();
  const partial = (raw && typeof raw === 'object' ? raw : {}) as Partial<OptionsLocalState>;
  const syncToCloud = await ensureSyncToCloud();
  const resolved: OptionsLocalState = {
    ...defaults,
    ...partial,
    schemaVersion:
      typeof partial.schemaVersion === 'number' ? partial.schemaVersion : defaults.schemaVersion,
    customCss: typeof partial.customCss === 'string' ? partial.customCss : defaults.customCss,
    dismissedUpdateVersion:
      typeof partial.dismissedUpdateVersion === 'string'
        ? partial.dismissedUpdateVersion
        : defaults.dismissedUpdateVersion,
    syncToCloud,
    uploadedBackgroundImage:
      typeof partial.uploadedBackgroundImage === 'string'
        ? partial.uploadedBackgroundImage
        : defaults.uploadedBackgroundImage,
  };

  if (typeof partial.syncToCloud !== 'boolean') {
    void writeTo(chrome.storage.local, KEYS.optionsLocal, resolved);
  }
  lastOptionsLocalPersistJson = JSON.stringify(resolved);
  return resolved;
}

export async function setOptionsLocal(state: OptionsLocalState): Promise<void> {
  resolvedSyncToCloud = state.syncToCloud;
  const json = JSON.stringify(state);
  if (json === lastOptionsLocalPersistJson) return;
  await writeTo(chrome.storage.local, KEYS.optionsLocal, state);
  lastOptionsLocalPersistJson = json;
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
