import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applySettingsBackupFromJson,
  downloadSettingsBackup,
  parseSettingsBackupJson,
} from './backup';
import {
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
  SCHEMA_VERSION,
} from '../storage/schema';
import type { SettingsDeps } from './deps';

function makeDeps(): SettingsDeps {
  return {
    layout: createDefaultLayoutState(),
    options: createDefaultOptionsState(),
    optionsLocal: createDefaultOptionsLocalState(),
    saveLayout: vi.fn(),
    saveLayoutNow: vi.fn(),
    saveOptions: vi.fn(),
    saveOptionsNow: vi.fn(),
    saveOptionsLocal: vi.fn(),
    refreshPanel: vi.fn(),
    rerenderPage: vi.fn(),
    rebindGridInteractions: vi.fn(),
    flushPendingSaves: vi.fn(),
    saveWidgetSettings: vi.fn(),
    resetBookmarkLayout: vi.fn(),
    setLayoutDirect: vi.fn(),
    setOptionsDirect: vi.fn(),
    setOptionsLocalDirect: vi.fn(),
    saveLayoutToCloud: vi.fn(async () => {}),
    restoreLayoutFromCloud: vi.fn(async () => false),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseSettingsBackupJson', () => {
  it('migrates a v1 layout through the storage pipeline', () => {
    const json = JSON.stringify({
      layout: {
        schemaVersion: 1,
        columns: [
          { id: 'bm:10', type: 'bookmarkFolder', order: 0, enabled: true, bookmarkId: '10' },
        ],
        folderState: {},
      },
      options: { schemaVersion: 1 },
      optionsLocal: { schemaVersion: 1, customCss: '' },
    });

    const parsed = parseSettingsBackupJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.layout.schemaVersion).toBe(3);
    expect(parsed.backup.layout.columns[0]).toMatchObject({
      id: 'grid:10',
      type: 'bookmarkGrid',
      stack: ['10'],
    });
  });

  it('always disables syncToCloud on import even if a legacy backup had it enabled', () => {
    const json = JSON.stringify({
      layout: { schemaVersion: 3, columns: [], folderState: {} },
      options: { schemaVersion: 3 },
      optionsLocal: { schemaVersion: 3, customCss: '', syncToCloud: true },
    });
    const parsed = parseSettingsBackupJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.optionsLocal.syncToCloud).toBe(false);
  });

  it('treats missing syncToCloud as off on import', () => {
    const json = JSON.stringify({
      layout: { schemaVersion: 3, columns: [], folderState: {} },
      options: { schemaVersion: 3 },
      optionsLocal: { schemaVersion: 3, customCss: '' },
    });
    const parsed = parseSettingsBackupJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.optionsLocal.syncToCloud).toBe(false);
  });

  it('validates uploadedBackgroundImage, background.imageUrl, and optionsLocal.schemaVersion', () => {
    const json = JSON.stringify({
      layout: { schemaVersion: 3, columns: [], folderState: {} },
      options: {
        schemaVersion: 3,
        background: { imageUrl: 'javascript:alert(1)' },
      },
      optionsLocal: {
        schemaVersion: 'bad',
        customCss: '',
        uploadedBackgroundImage: 'https://evil.example/image.png',
      },
    });
    const parsed = parseSettingsBackupJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.options.background.imageUrl).toBe('');
    expect(parsed.backup.optionsLocal.uploadedBackgroundImage).toBe('');
    expect(parsed.backup.optionsLocal.schemaVersion).toBe(SCHEMA_VERSION);

    const validDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const validJson = JSON.stringify({
      layout: { schemaVersion: 3, columns: [], folderState: {} },
      options: {
        schemaVersion: 3,
        background: { imageUrl: 'https://example.com/bg.jpg' },
      },
      optionsLocal: {
        schemaVersion: 3,
        customCss: '',
        uploadedBackgroundImage: validDataUrl,
      },
    });
    const parsedValid = parseSettingsBackupJson(validJson);
    expect(parsedValid.ok).toBe(true);
    if (!parsedValid.ok) return;
    expect(parsedValid.backup.options.background.imageUrl).toBe('https://example.com/bg.jpg');
    expect(parsedValid.backup.optionsLocal.uploadedBackgroundImage).toBe(validDataUrl);
  });
});

describe('applySettingsBackupFromJson', () => {
  it('applies backup via setLayoutDirect and refreshPanel without redundant rerenderPage', () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const deps = makeDeps();
    const json = JSON.stringify({
      layout: { schemaVersion: 3, columns: [], folderState: {} },
      options: { schemaVersion: 3 },
      optionsLocal: { schemaVersion: 3, customCss: '' },
    });

    expect(applySettingsBackupFromJson(deps, json)).toBe(true);
    expect(deps.setOptionsLocalDirect).toHaveBeenCalledOnce();
    expect(deps.setOptionsDirect).toHaveBeenCalledOnce();
    expect(deps.setLayoutDirect).toHaveBeenCalledOnce();
    expect(deps.refreshPanel).toHaveBeenCalledOnce();
    expect(deps.rerenderPage).not.toHaveBeenCalled();
  });
});

describe('downloadSettingsBackup', () => {
  it('defers URL.revokeObjectURL until after click', () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const deps = makeDeps();
    const textarea = document.createElement('textarea');

    downloadSettingsBackup(deps, textarea);

    expect(createSpy).toHaveBeenCalledOnce();
    expect(revokeSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });
});
