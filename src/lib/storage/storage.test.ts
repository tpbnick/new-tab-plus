import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLayout,
  getOptionsLocal,
  getOptionsSynced,
  loadLayout,
  optionsAffectLayout,
  optionsForCloud,
  optionsGridInteractionsChanged,
  optionsOnlyGridInteractionsChanged,
  resetStorageStateForTests,
  setLayout,
  setOptionsLocal,
  setOptionsSynced,
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
    await chrome.storage.sync.set({
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

  it('enables save-to-cloud when existing sync data is present', async () => {
    await chrome.storage.sync.set({ options: { schemaVersion: SCHEMA_VERSION } });
    const local = await getOptionsLocal();
    expect(local.syncToCloud).toBe(true);
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
    const local = mockStorageData('local');
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
