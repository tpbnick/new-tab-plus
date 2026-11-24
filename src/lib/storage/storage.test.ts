import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLayout,
  getOptionsLocal,
  getOptionsSynced,
  isSelfStorageWrite,
  loadLayout,
  migrateAndNormalizeLayout,
  moveAutomaticCloudCopyToLocal,
  optionsAffectLayout,
  optionsForCloud,
  optionsGridInteractionsChanged,
  optionsOnlyGridInteractionsChanged,
  resetStorageStateForTests,
  setLayout,
  setOptionsLocal,
  setOptionsSynced,
  writeCloudSnapshot,
} from './storage';
import {
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
  mergeOptionsState,
  SCHEMA_VERSION,
  type OptionsState,
  type TopBarItemId,
} from './schema';

function makeStorageArea() {
  const data: Record<string, unknown> = {};
  return {
    async get(key: string | string[] | null) {
      if (key === null) return { ...data };
      if (Array.isArray(key)) {
        const out: Record<string, unknown> = {};
        for (const k of key) {
          if (k in data) out[k] = data[k];
        }
        return out;
      }
      return key in data ? { [key]: data[key] } : {};
    },
    async set(items: Record<string, unknown>) {
      Object.assign(data, items);
    },
    data,
  };
}

function mockStorageData(area: 'sync' | 'local'): Record<string, unknown> {
  return (chrome.storage[area] as unknown as ReturnType<typeof makeStorageArea>).data;
}

beforeEach(() => {
  resetStorageStateForTests();
  vi.stubGlobal('chrome', {
    storage: {
      sync: makeStorageArea(),
      local: makeStorageArea(),
    },
  });
});

describe('storage', () => {
  it('returns default layout state when nothing is stored', async () => {
    const { layout, hadStoredLayout, source } = await loadLayout();
    expect(layout).toEqual(createDefaultLayoutState());
    expect(hadStoredLayout).toBe(false);
    expect(source).toBe('default');
  });

  it('seeds default layout with all four special sections present but disabled', async () => {
    const layout = await getLayout();
    const kinds = layout.columns
      .filter((c) => c.type === 'specialSection')
      .map((c) => (c as { kind: string }).kind);
    expect(kinds.sort()).toEqual(['apps', 'mostVisited', 'otherDevices', 'recentlyClosed']);
    expect(layout.columns.filter((c) => c.type === 'specialSection').every((c) => c.enabled)).toBe(false);
  });

  it('round-trips a layout state through sync storage', async () => {
    const layout = createDefaultLayoutState();
    layout.columns.push({
      id: 'grid:1',
      type: 'bookmarkGrid',
      order: 0,
      enabled: true,
      stack: ['1'],
    });

    await setLayout(layout);
    const reloaded = await getLayout();
    expect(reloaded).toEqual(layout);
  });

  it('stores layout locally when save-to-cloud is off', async () => {
    await setOptionsLocal({ ...createDefaultOptionsLocalState(), syncToCloud: false });
    const layout = createDefaultLayoutState();
    layout.folderState = { '10': { collapsed: true } };

    await setLayout(layout);
    expect(mockStorageData('sync').layout).toBeUndefined();
    expect(mockStorageData('local').layout).toBeDefined();

    const reloaded = await getLayout();
    expect(reloaded.folderState).toEqual({ '10': { collapsed: true } });
  });

  it('reports hadStoredLayout when layout exists in local storage', async () => {
    const layout = createDefaultLayoutState();
    layout.folderState = { '1': { collapsed: true } };
    await setLayout(layout);

    const loaded = await loadLayout();
    expect(loaded.hadStoredLayout).toBe(true);
    expect(loaded.source).toBe('local');
    expect(loaded.layout.folderState).toEqual({ '1': { collapsed: true } });
  });

  it('falls back from empty sync to local layout when save-to-cloud is on', async () => {
    await setOptionsLocal({ ...createDefaultOptionsLocalState(), syncToCloud: true });
    const layout = createDefaultLayoutState();
    layout.folderState = { '2': { collapsed: true } };
    await chrome.storage.local.set({ layout });

    const loaded = await loadLayout();
    expect(loaded.hadStoredLayout).toBe(true);
    expect(loaded.layout.folderState).toEqual({ '2': { collapsed: true } });
    expect(mockStorageData('sync').layout).toBeDefined();
  });

  it('keeps save-to-cloud off when an earlier syncBookmarkLayout toggle was disabled', async () => {
    await chrome.storage.sync.set({
      options: { schemaVersion: SCHEMA_VERSION, general: { syncBookmarkLayout: false } },
    });
    const local = await getOptionsLocal();
    expect(local.syncToCloud).toBe(false);
  });

  it('returns default options state when nothing is stored', async () => {
    const options = await getOptionsSynced();
    expect(options.theme.fontSizePx).toBe(createDefaultOptionsState().theme.fontSizePx);
  });

  it('fills missing nested theme defaults when loading partial options', async () => {
    await chrome.storage.local.set({
      options: {
        schemaVersion: 2,
        theme: { fontSizePx: 18 },
      },
    });
    const options = await getOptionsSynced();
    expect(options.theme.fontSizePx).toBe(18);
    expect(options.theme.regionGapPx).toBe(createDefaultOptionsState().theme.regionGapPx);
    expect(options.theme.colors.shadow).toBe(createDefaultOptionsState().theme.colors.shadow);
  });

  it('does not silently load cloud options or skip initial persist when save-to-cloud is off', async () => {
    await chrome.storage.sync.set({
      options: {
        schemaVersion: SCHEMA_VERSION,
        theme: { fontSizePx: 22 },
      },
    });
    const options = await getOptionsSynced();
    expect(options.theme.fontSizePx).toBe(createDefaultOptionsState().theme.fontSizePx);

    await setOptionsSynced(options);
    expect(mockStorageData('local').options).toBeDefined();
  });

  it('does not copy a portable path: cloud snapshot into local storage when save-to-cloud is off', async () => {
    await chrome.storage.sync.set({
      layout: {
        schemaVersion: SCHEMA_VERSION,
        columns: [
          {
            id: 'grid:path:1/Work',
            type: 'bookmarkGrid',
            order: 0,
            enabled: true,
            stack: ['path:1/Work'],
          },
        ],
      },
      folderState: { 'path:1/Work': { collapsed: true } },
    });

    const loaded = await loadLayout();
    expect(loaded.source).toBe('default');
    expect(loaded.hadStoredLayout).toBe(false);
    expect(mockStorageData('local').layout).toBeUndefined();
    expect(mockStorageData('local').folderState).toBeUndefined();
  });

  it('translates portable path: keys when moving automatic cloud copy to local', async () => {
    await setOptionsLocal({ ...createDefaultOptionsLocalState(), syncToCloud: true });
    vi.stubGlobal('chrome', {
      ...chrome,
      bookmarks: {
        getTree: vi.fn(async () => [
          {
            id: '0',
            title: 'root',
            children: [
              {
                id: '1',
                title: 'Bookmarks Bar',
                children: [{ id: '80', title: 'Work', children: [] }],
              },
            ],
          },
        ]),
      },
    });

    await chrome.storage.sync.set({
      layout: {
        schemaVersion: SCHEMA_VERSION,
        columns: [
          {
            id: 'grid:path:1/Work',
            type: 'bookmarkGrid',
            order: 0,
            enabled: true,
            stack: ['path:1/Work'],
          },
        ],
      },
      folderState: { 'path:1/Work': { collapsed: true } },
    });

    await moveAutomaticCloudCopyToLocal();

    const loaded = await loadLayout();
    expect(loaded.source).toBe('local');
    const gridCol = loaded.layout.columns.find((c) => c.type === 'bookmarkGrid');
    expect(gridCol?.id).toBe('grid:80');
    expect(gridCol?.type === 'bookmarkGrid' ? gridCol.stack : []).toEqual(['80']);
    expect(loaded.layout.folderState).toEqual({ '80': { collapsed: true } });
  });

  it('persists duplicate built-in widget cleanup and upgrades schemaVersion < 1 without re-persisting', async () => {
    const localArea = chrome.storage.local;
    const setSpy = vi.spyOn(localArea, 'set');

    await localArea.set({
      layout: {
        schemaVersion: 0,
        columns: [
          {
            id: 'widget:weather-1',
            type: 'widget',
            order: 100,
            enabled: false,
            widgetId: 'weather',
            instanceId: '1',
            settings: { units: 'metric' },
          },
          {
            id: 'widget:weather-2',
            type: 'widget',
            order: 101,
            enabled: true,
            widgetId: 'weather',
            instanceId: '2',
            settings: { city: 'Paris' },
          },
        ],
      },
      folderState: {},
    });
    setSpy.mockClear();

    const first = await loadLayout();
    expect(first.layout.schemaVersion).toBe(SCHEMA_VERSION);
    expect(first.layout.columns.filter((c) => c.type === 'widget')).toHaveLength(1);
    expect(setSpy).toHaveBeenCalledTimes(1);

    setSpy.mockClear();
    const second = await loadLayout();
    expect(second.layout.schemaVersion).toBe(SCHEMA_VERSION);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('validates all cloud snapshot items upfront and writes them atomically', async () => {
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');
    const layout = createDefaultLayoutState();
    const oversizedOptions = createDefaultOptionsState();
    oversizedOptions.background.imageUrl = `https://example.com/${'a'.repeat(9000)}`;

    await expect(writeCloudSnapshot(layout, oversizedOptions)).rejects.toThrow(
      /Chrome sync item "options"/
    );
    expect(syncSetSpy).not.toHaveBeenCalled();
    expect(mockStorageData('sync').layout).toBeUndefined();

    const validOptions = createDefaultOptionsState();
    await writeCloudSnapshot(layout, validOptions);
    expect(syncSetSpy).toHaveBeenCalledTimes(1);
    expect(isSelfStorageWrite('sync', 'layout')).toBe(true);
    expect(isSelfStorageWrite('sync', 'folderState')).toBe(true);
    expect(isSelfStorageWrite('sync', 'options')).toBe(true);
  });

  it('handles malformed nested fields safely in mergeOptionsState', () => {
    const merged = mergeOptionsState({
      schemaVersion: 1,
      general: { rememberOpenFolders: 'yes', folderCollapseAnimationMs: Number.NaN },
      topBar: { itemOrder: 42, maxWidthPx: 999999, widgetScale: -5 },
      theme: {
        fontSizePx: null,
        colors: { background: null, text: '' },
        customSnapshot: 'invalid',
      },
      background: { imageUrl: null, imageOpacityPct: 'bad', size: 'stretch' },
    } as unknown as Partial<OptionsState>);

    const defaults = createDefaultOptionsState();
    expect(merged.schemaVersion).toBe(SCHEMA_VERSION);
    expect(merged.general.rememberOpenFolders).toBe(defaults.general.rememberOpenFolders);
    expect(merged.general.folderCollapseAnimationMs).toBe(defaults.general.folderCollapseAnimationMs);
    expect(merged.topBar.itemOrder).toEqual(['search', 'clock', 'weather']);
    expect(merged.topBar.maxWidthPx).toBe(3840);
    expect(merged.topBar.widgetScale).toBe(0.5);
    expect(merged.theme.fontSizePx).toBe(defaults.theme.fontSizePx);
    expect(merged.theme.colors.background).toBe(defaults.theme.colors.background);
    expect(merged.theme.colors.text).toBe(defaults.theme.colors.text);
    expect(merged.background.imageUrl).toBe('');
    expect(merged.background.size).toBe(defaults.background.size);
  });

  it('strips uppercase DATA: background URLs from cloud options', () => {
    const options = createDefaultOptionsState();
    options.background.imageUrl = 'DATA:IMAGE/PNG;base64,abc';
    expect(optionsForCloud(options).background.imageUrl).toBe('');
  });

  it('reads optionsLocal in a single storage.local.get call', async () => {
    await chrome.storage.local.set({
      optionsLocal: { ...createDefaultOptionsLocalState(), syncToCloud: false },
    });
    const getSpy = vi.spyOn(chrome.storage.local, 'get');
    await getOptionsLocal();
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('normalizes schemaVersion in migrateAndNormalizeLayout even when raw schemaVersion < 1', () => {
    const result = migrateAndNormalizeLayout({
      schemaVersion: 0,
      columns: [],
      folderState: {},
    });
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('mergeOptionsState deep-merges theme colors', () => {
    const merged = mergeOptionsState({
      schemaVersion: 2,
      theme: { colors: { text: '#ffffff' } },
    } as Partial<OptionsState>);
    expect(merged.theme.colors.text).toBe('#ffffff');
    expect(merged.theme.colors.background).toBe(createDefaultOptionsState().theme.colors.background);
  });

  it('returns default local options state when nothing is stored', async () => {
    const local = await getOptionsLocal();
    expect(local.customCss).toBe('');
    expect(local.schemaVersion).toBe(SCHEMA_VERSION);
    expect(local.syncToCloud).toBe(false);
    expect(local.uploadedBackgroundImage).toBe('');
  });

  it('keeps save-to-cloud off for new installs', async () => {
    const local = await getOptionsLocal();
    expect(local.syncToCloud).toBe(false);
    await setLayout(createDefaultLayoutState());
    expect(mockStorageData('local').layout).toBeDefined();
    expect(mockStorageData('sync').layout).toBeUndefined();
  });

  it('leaves save-to-cloud off when existing sync data is present', async () => {
    await chrome.storage.sync.set({ options: { schemaVersion: SCHEMA_VERSION } });
    const local = await getOptionsLocal();
    expect(local.syncToCloud).toBe(false);
  });

  it('picks up a syncToCloud change written by another tab', async () => {
    await setOptionsLocal({ ...createDefaultOptionsLocalState(), syncToCloud: false });
    await chrome.storage.local.set({
      optionsLocal: { ...createDefaultOptionsLocalState(), syncToCloud: true },
    });

    const local = await getOptionsLocal();
    expect(local.syncToCloud).toBe(true);
  });

  it('copies an automatic cloud layout onto this device and stops continuous sync', async () => {
    await setOptionsLocal({ ...createDefaultOptionsLocalState(), syncToCloud: true });
    const layout = createDefaultLayoutState();
    layout.folderState = { '4': { collapsed: true } };
    await setLayout(layout);
    delete mockStorageData('local').layout;
    delete mockStorageData('local').folderState;

    await moveAutomaticCloudCopyToLocal();

    const local = await getOptionsLocal();
    expect(local.syncToCloud).toBe(false);
    const loaded = await loadLayout();
    expect(loaded.source).toBe('local');
    expect(loaded.layout.folderState).toEqual({ '4': { collapsed: true } });
    expect(mockStorageData('sync').layout).toBeDefined();
  });

  it('returns the sanitized layout from setLayout', async () => {
    const layout = createDefaultLayoutState();
    const saved = await setLayout(layout);
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION);
    expect(saved.columns).toEqual(layout.columns);
  });

  it('strips data: background URLs from cloud options', () => {
    const options = createDefaultOptionsState();
    options.background.imageUrl = 'data:image/png;base64,abc';
    expect(optionsForCloud(options).background.imageUrl).toBe('');
    options.background.imageUrl = 'https://example.com/bg.jpg';
    expect(optionsForCloud(options).background.imageUrl).toBe('https://example.com/bg.jpg');
  });

  it('writes layout to sync after save-to-cloud is enabled', async () => {
    await setOptionsLocal({ ...createDefaultOptionsLocalState(), syncToCloud: true });
    const layout = createDefaultLayoutState();
    await setLayout(layout);
    const stored = mockStorageData('sync');
    expect(stored.layout).toEqual({ schemaVersion: layout.schemaVersion, columns: layout.columns });
    expect(stored.folderState).toEqual(layout.folderState);
  });

  it('reads a legacy combined layout that still embeds folderState', async () => {
    const layout = createDefaultLayoutState();
    layout.folderState = { '10': { collapsed: true } };
    await chrome.storage.local.set({ layout });
    const reloaded = await getLayout();
    expect(reloaded.folderState).toEqual({ '10': { collapsed: true } });
  });

  it('skips unchanged options writes after the last successful persist', async () => {
    const options = await getOptionsSynced();
    await setOptionsSynced(options);
    const local = mockStorageData('local');
    expect(local.options).toBeDefined();

    delete local.options;
    await setOptionsSynced(options);
    expect(local.options).toBeUndefined();

    const localOptions = await getOptionsLocal();
    delete local.optionsLocal;
    await setOptionsLocal(localOptions);
    expect(local.optionsLocal).toBeUndefined();
  });

  it('writes full options locally and a stripped copy to sync when cloud is on', async () => {
    await setOptionsLocal({ ...createDefaultOptionsLocalState(), syncToCloud: true });
    const options = createDefaultOptionsState();
    options.background.imageUrl = 'data:image/png;base64,abc';
    await setOptionsSynced(options);
    const local = mockStorageData('local');
    const sync = mockStorageData('sync');
    expect((local.options as OptionsState).background.imageUrl).toBe('data:image/png;base64,abc');
    expect((sync.options as OptionsState).background.imageUrl).toBe('');
  });

  it('rejects oversized chrome sync layout writes', async () => {
    await setOptionsLocal({ ...createDefaultOptionsLocalState(), syncToCloud: true });
    const layout = createDefaultLayoutState();
    for (let i = 0; i < 400; i++) {
      layout.columns.push({
        id: `grid:${i}`,
        type: 'bookmarkGrid',
        order: i,
        enabled: true,
        stack: [`folder-${i}-aaaaaaaaaaaaaaaa`],
      });
    }
    await expect(setLayout(layout)).rejects.toThrow(/Chrome sync item "layout"/);
  });
});

describe('optionsAffectLayout', () => {
  it('returns false when only theme fields change', () => {
    const before = createDefaultOptionsState();
    const after = {
      ...before,
      theme: { ...before.theme, fontSizePx: 20 },
    };
    expect(optionsAffectLayout(before, after)).toBe(false);
  });

  it('returns true when bookmark rendering options change', () => {
    const before = createDefaultOptionsState();
    const after = {
      ...before,
      general: { ...before.general, rememberOpenFolders: false },
    };
    expect(optionsAffectLayout(before, after)).toBe(true);
  });

  it('returns true when top bar item order changes', () => {
    const before = createDefaultOptionsState();
    const after = {
      ...before,
      topBar: { ...before.topBar, itemOrder: ['weather', 'search', 'clock'] as TopBarItemId[] },
    };
    expect(optionsAffectLayout(before, after)).toBe(true);
  });

  it('returns true when search visibility changes', () => {
    const before = createDefaultOptionsState();
    expect(
      optionsAffectLayout(before, {
        ...before,
        topBar: { ...before.topBar, searchEnabled: false },
      })
    ).toBe(true);
  });

  it('returns false when only search engine changes', () => {
    const before = createDefaultOptionsState();
    expect(
      optionsAffectLayout(before, {
        ...before,
        topBar: { ...before.topBar, searchEngine: 'duckduckgo' },
      })
    ).toBe(false);
  });
});

describe('optionsGridInteractionsChanged', () => {
  it('returns true when lock columns changes', () => {
    const before = createDefaultOptionsState();
    const after = {
      ...before,
      general: { ...before.general, lockColumns: true },
    };
    expect(optionsGridInteractionsChanged(before, after)).toBe(true);
    expect(optionsOnlyGridInteractionsChanged(before, after)).toBe(true);
    expect(optionsAffectLayout(before, after)).toBe(false);
  });

  it('returns false when only theme changes', () => {
    const before = createDefaultOptionsState();
    const after = {
      ...before,
      theme: { ...before.theme, fontSizePx: 20 },
    };
    expect(optionsOnlyGridInteractionsChanged(before, after)).toBe(false);
  });
});
