import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLayout,
  getOptionsLocal,
  getOptionsSynced,
  loadLayout,
  migrateLayoutStorage,
  optionsAffectLayout,
  optionsGridInteractionsChanged,
  optionsOnlyGridInteractionsChanged,
  setLayout,
  setOptionsSynced,
} from './storage';
import { createDefaultLayoutState, createDefaultOptionsState, mergeOptionsState, SCHEMA_VERSION, type OptionsState, type TopBarItemId } from './schema';

function makeStorageArea() {
  const data: Record<string, unknown> = {};
  return {
    async get(key: string | string[] | null) {
      if (key === null) return { ...data };
      if (Array.isArray(key)) {
        return Object.fromEntries(key.filter((k) => k in data).map((k) => [k, data[k]]));
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

  it('stores layout locally when sync bookmark layout is disabled', async () => {
    const options = createDefaultOptionsState();
    options.general.syncBookmarkLayout = false;
    await setOptionsSynced(options);

    const layout = createDefaultLayoutState();
    layout.folderState = { '10': { collapsed: true } };

    await setLayout(layout, options);
    expect(mockStorageData('sync').layout).toBeUndefined();
    expect(mockStorageData('local').layout).toBeDefined();

    const reloaded = await getLayout(options);
    expect(reloaded.folderState).toEqual({ '10': { collapsed: true } });
  });

  it('copies layout to local storage when toggling sync off', async () => {
    const layout = createDefaultLayoutState();
    layout.folderState = { '99': { collapsed: true } };
    await setLayout(layout);

    await migrateLayoutStorage(false, layout);

    const options = createDefaultOptionsState();
    options.general.syncBookmarkLayout = false;
    const localLayout = await getLayout(options);
    expect(localLayout.folderState).toEqual({ '99': { collapsed: true } });
  });

  it('reports hadStoredLayout when layout exists in sync storage', async () => {
    const layout = createDefaultLayoutState();
    layout.folderState = { '1': { collapsed: true } };
    await setLayout(layout);

    const loaded = await loadLayout();
    expect(loaded.hadStoredLayout).toBe(true);
    expect(loaded.source).toBe('sync');
    expect(loaded.layout.folderState).toEqual({ '1': { collapsed: true } });
  });

  it('falls back from empty sync to local layout when sync is enabled', async () => {
    const layout = createDefaultLayoutState();
    layout.folderState = { '2': { collapsed: true } };
    await chrome.storage.local.set({ layout });

    const loaded = await loadLayout();
    expect(loaded.hadStoredLayout).toBe(true);
    expect(loaded.layout.folderState).toEqual({ '2': { collapsed: true } });
    expect(mockStorageData('sync').layout).toBeDefined();
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
