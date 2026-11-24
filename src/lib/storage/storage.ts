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
import {
  buildBookmarkPathMaps,
  collectBookmarkIds,
  isBookmarkPathKey,
  layoutFromPortableBookmarks,
} from '../bookmarks/bookmarkPaths';
import { clampTopBarOptions, normalizeTopBarItemOrder } from '../topBar/topBarLayout';
import { showSaveError } from '../ui/saveErrorBanner';

const KEYS = {
  layout: 'layout',
  folderState: 'folderState',
  options: 'options',
  optionsLocal: 'optionsLocal',
} as const;

const DATA_URL_RE = /^data:/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Chrome sync QUOTA_BYTES_PER_ITEM is 8192; leave a small margin for the key name. */
export const SYNC_ITEM_MAX_BYTES = 8000;

/** Recent writes from this tab — onChanged can arrive after set() resolves. */
const recentSelfWrites = new Map<string, number>();
const SELF_WRITE_TTL_MS = 750;

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

/** Test-only: clear persist-dedupe caches and self-write marks. */
export function resetStorageStateForTests(): void {
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
  const migrated = runMigrations(raw, SCHEMA_VERSION);
  return normalizeLayoutColumns(coerceLayoutState(migrated));
}

function layoutRecord(state: LayoutState): Pick<LayoutState, 'schemaVersion' | 'columns'> {
  return { schemaVersion: state.schemaVersion, columns: state.columns };
}

function assembleLayoutRaw(layoutRaw: unknown, folderRaw: unknown): unknown {
  if (layoutRaw === undefined) return undefined;
  if (!isPlainObject(layoutRaw)) return layoutRaw;
  const embedded = (layoutRaw as Partial<LayoutState>).folderState;
  const folderState = isPlainObject(folderRaw) ? folderRaw : embedded;
  return { ...layoutRaw, folderState: folderState ?? {} };
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
  const now = Date.now();
  recentSelfWrites.set(storageKey(areaName, KEYS.layout), now);
  recentSelfWrites.set(storageKey(areaName, KEYS.folderState), now);
  await area.set({
    [KEYS.layout]: record,
    [KEYS.folderState]: sanitized.folderState,
  });
}

function layoutNeedsPersist(raw: unknown): boolean {
  return !isLayoutNormalized(raw as LayoutState);
}

/** Always re-read the flag. A cached value ignores toggles made in another tab. */
async function ensureSyncToCloud(): Promise<boolean> {
  const result = await chrome.storage.local.get(KEYS.optionsLocal);
  const raw = result[KEYS.optionsLocal];
  return isPlainObject(raw) && raw.syncToCloud === true;
}

/** Drop data: background URLs — they are too large for Chrome sync and stay local. */
export function optionsForCloud(state: OptionsState): OptionsState {
  const url = state.background.imageUrl.trim();
  if (DATA_URL_RE.test(url)) {
    return { ...state, background: { ...state.background, imageUrl: '' } };
  }
  return state;
}

function mergeCloudAndLocalOptions(cloudRaw: unknown, localRaw: unknown): OptionsState {
  const cloudObj = isPlainObject(cloudRaw) ? (cloudRaw as Partial<OptionsState>) : undefined;
  const localObj = isPlainObject(localRaw) ? (localRaw as Partial<OptionsState>) : undefined;
  const primary = cloudObj ?? localObj;
  if (primary === undefined) return createDefaultOptionsState();
  const merged = normalizeOptions(mergeOptionsState(primary));
  if (localObj && isPlainObject(localObj.background)) {
    const localUrl = typeof localObj.background.imageUrl === 'string' ? localObj.background.imageUrl : '';
    if (DATA_URL_RE.test(localUrl.trim()) && !DATA_URL_RE.test(merged.background.imageUrl.trim())) {
      merged.background.imageUrl = localUrl;
    }
  }
  return merged;
}

function layoutHasPortableBookmarkKeys(layout: LayoutState): boolean {
  for (const col of layout.columns) {
    if (col.type !== 'bookmarkGrid') continue;
    if (col.id.startsWith('grid:path:') || col.id.startsWith('grid:stack:path:')) return true;
    if (col.stack.some((id) => isBookmarkPathKey(id))) return true;
  }
  for (const key of Object.keys(layout.folderState)) {
    if (isBookmarkPathKey(key)) return true;
  }
  return false;
}

export type LayoutStorageSource = 'sync' | 'local' | 'default';

export interface LayoutLoadResult {
  layout: LayoutState;
  source: LayoutStorageSource;
  /** False when no layout existed in the active storage area (implicit default only). */
  hadStoredLayout: boolean;
}

export async function loadLayout(): Promise<LayoutLoadResult> {
  const useSync = await ensureSyncToCloud();
  const primary = useSync ? chrome.storage.sync : chrome.storage.local;
  const primarySource: LayoutStorageSource = useSync ? 'sync' : 'local';
  let raw = await readLayoutRaw(primary);
  if (raw === undefined) {
    if (useSync) {
      raw = await readLayoutRaw(chrome.storage.local);
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
    }
    return {
      layout: createDefaultLayoutState(),
      source: 'default',
      hadStoredLayout: false,
    };
  }

  const sanitized = migrateAndNormalizeLayout(raw);
  if (layoutNeedsPersist(raw)) {
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

/** Writes layout on this device even when an older profile still has cloud sync enabled. */
export async function setLayoutLocal(state: LayoutState): Promise<LayoutState> {
  const sanitized = migrateAndNormalizeLayout(state);
  await writeLayout(chrome.storage.local, sanitized);
  return sanitized;
}

export async function readCloudSnapshot(): Promise<{
  layout: LayoutState;
  options: OptionsState | null;
} | null> {
  const raw = await readLayoutRaw(chrome.storage.sync);
  if (raw === undefined) return null;
  const optionsRaw = (await chrome.storage.sync.get(KEYS.options))[KEYS.options];
  const options = isPlainObject(optionsRaw)
    ? normalizeOptions(mergeOptionsState(optionsRaw as Partial<OptionsState>))
    : null;
  return { layout: migrateAndNormalizeLayout(raw), options };
}

export async function writeCloudSnapshot(layout: LayoutState, options: OptionsState): Promise<void> {
  const sanitized = migrateAndNormalizeLayout(layout);
  const record = layoutRecord(sanitized);
  const cloudOptions = optionsForCloud(normalizeOptions(options));

  assertSyncItemFits(KEYS.layout, record);
  assertSyncItemFits(KEYS.folderState, sanitized.folderState);
  assertSyncItemFits(KEYS.options, cloudOptions);

  const now = Date.now();
  recentSelfWrites.set(storageKey('sync', KEYS.layout), now);
  recentSelfWrites.set(storageKey('sync', KEYS.folderState), now);
  recentSelfWrites.set(storageKey('sync', KEYS.options), now);

  await chrome.storage.sync.set({
    [KEYS.layout]: record,
    [KEYS.folderState]: sanitized.folderState,
    [KEYS.options]: cloudOptions,
  });
}

/**
 * Older builds mirrored every edit to Chrome sync. Copy that cloud layout onto
 * this device once, then leave further cloud copies to the explicit Save button.
 */
export async function moveAutomaticCloudCopyToLocal(): Promise<void> {
  const local = await getOptionsLocal();
  if (!local.syncToCloud) return;

  const raw = await readLayoutRaw(chrome.storage.sync);
  if (raw !== undefined) {
    let layout = migrateAndNormalizeLayout(raw);
    if (layoutHasPortableBookmarkKeys(layout)) {
      if (typeof chrome.bookmarks?.getTree === 'function') {
        const tree = await chrome.bookmarks.getTree();
        const { pathToId } = buildBookmarkPathMaps(tree);
        layout = layoutFromPortableBookmarks(layout, pathToId, collectBookmarkIds(tree));
      } else {
        layout = layoutFromPortableBookmarks(layout, new Map(), new Set());
      }
    }
    await writeLayout(chrome.storage.local, layout);
  }

  const syncOptions = (await chrome.storage.sync.get(KEYS.options))[KEYS.options];
  if (isPlainObject(syncOptions)) {
    const localOptions = (await chrome.storage.local.get(KEYS.options))[KEYS.options];
    await writeTo(
      chrome.storage.local,
      KEYS.options,
      normalizeOptions(mergeCloudAndLocalOptions(syncOptions, localOptions))
    );
  }

  await setOptionsLocal({ ...local, syncToCloud: false });
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
  const localObj = isPlainObject(localRaw) ? (localRaw as Partial<OptionsState>) : undefined;
  let resolved: OptionsState;
  let persistedInTarget: boolean;
  if (!useSync) {
    if (localObj === undefined) {
      resolved = createDefaultOptionsState();
      persistedInTarget = false;
    } else {
      resolved = normalizeOptions(mergeOptionsState(localObj));
      persistedInTarget = true;
    }
  } else {
    const cloudRaw = (await chrome.storage.sync.get(KEYS.options))[KEYS.options];
    const cloudObj = isPlainObject(cloudRaw) ? (cloudRaw as Partial<OptionsState>) : undefined;
    resolved = mergeCloudAndLocalOptions(cloudObj, localObj);
    persistedInTarget = cloudObj !== undefined && localObj !== undefined;
  }
  lastOptionsPersistKey = persistedInTarget ? optionsPersistKey(resolved, useSync) : '';
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
  const partial = (isPlainObject(raw) ? raw : {}) as Partial<OptionsLocalState>;
  const hasSyncFlag = typeof partial.syncToCloud === 'boolean';
  const syncToCloud = hasSyncFlag ? partial.syncToCloud! : false;
  const resolved: OptionsLocalState = {
    schemaVersion:
      typeof partial.schemaVersion === 'number' && Number.isFinite(partial.schemaVersion)
        ? partial.schemaVersion
        : defaults.schemaVersion,
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

  let persisted = hasSyncFlag;
  if (!hasSyncFlag) {
    await writeTo(chrome.storage.local, KEYS.optionsLocal, resolved)
      .then(() => {
        persisted = true;
      })
      .catch((err) => {
        console.error('[new-tab-plus] failed to persist default local options', err);
      });
  }
  lastOptionsLocalPersistJson = persisted ? JSON.stringify(resolved) : '';
  return resolved;
}

export async function setOptionsLocal(state: OptionsLocalState): Promise<void> {
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
