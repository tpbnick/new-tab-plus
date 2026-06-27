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

export async function getLayout(): Promise<LayoutState> {
  const result = await chrome.storage.sync.get(KEYS.layout);
  const raw = result[KEYS.layout];
  if (raw === undefined) {
    return createDefaultLayoutState();
  }
  const sanitized = loadLayoutFromRaw(raw);
  if (layoutNeedsPersist(raw, sanitized)) {
    void writeTo(chrome.storage.sync, KEYS.layout, sanitized);
  }
  return sanitized;
}

export async function setLayout(state: LayoutState): Promise<void> {
  return writeTo(chrome.storage.sync, KEYS.layout, loadLayoutFromRaw(state));
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
