import { describe, expect, it } from 'vitest';
import { parseSettingsBackupJson } from './backup';

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

  it('preserves an explicit save-to-cloud flag on import', () => {
    const json = JSON.stringify({
      layout: { schemaVersion: 3, columns: [], folderState: {} },
      options: { schemaVersion: 3 },
      optionsLocal: { schemaVersion: 3, customCss: '', syncToCloud: true },
    });
    const parsed = parseSettingsBackupJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.optionsLocal.syncToCloud).toBe(true);
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
});
