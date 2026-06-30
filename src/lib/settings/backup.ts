import { mergeOptionsState, SCHEMA_VERSION, type LayoutState, type OptionsLocalState, type OptionsState } from '../storage/schema';
import { sanitizeLayoutState } from '../storage/layoutNormalize';
import type { SettingsDeps } from './deps';

type SettingsBackupPayload = {
  layout: LayoutState;
  options: OptionsState;
  optionsLocal: OptionsLocalState;
};

export function exportSettingsJson(deps: SettingsDeps): string {
  const layout = sanitizeLayoutState(deps.layout);
  return JSON.stringify(
    {
      layout: {
        schemaVersion: layout.schemaVersion,
        columns: layout.columns,
        folderState: layout.folderState,
      },
      options: deps.options,
      optionsLocal: {
        schemaVersion: deps.optionsLocal.schemaVersion,
        customCss: deps.optionsLocal.customCss,
      },
    },
    null,
    2
  );
}

export function parseSettingsBackupJson(
  json: string
): { ok: true; backup: SettingsBackupPayload } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Backup must be a JSON object.' };
  }

  const root = parsed as Record<string, unknown>;
  const { layout: rawLayout, options: rawOptions, optionsLocal: rawOptionsLocal } = root;

  if (!rawLayout || typeof rawLayout !== 'object' || Array.isArray(rawLayout)) {
    return { ok: false, error: 'Backup is missing a valid layout section.' };
  }
  if (!rawOptions || typeof rawOptions !== 'object' || Array.isArray(rawOptions)) {
    return { ok: false, error: 'Backup is missing a valid options section.' };
  }
  if (!rawOptionsLocal || typeof rawOptionsLocal !== 'object' || Array.isArray(rawOptionsLocal)) {
    return { ok: false, error: 'Backup is missing a valid optionsLocal section.' };
  }

  const layoutPartial = rawLayout as Partial<LayoutState>;
  if (typeof layoutPartial.schemaVersion !== 'number' || !Array.isArray(layoutPartial.columns)) {
    return { ok: false, error: 'Backup layout must include schemaVersion and columns.' };
  }

  try {
    const optionsLocalPartial = rawOptionsLocal as Partial<OptionsLocalState>;
    return {
      ok: true,
      backup: {
        layout: sanitizeLayoutState(rawLayout),
        options: mergeOptionsState(rawOptions as Partial<OptionsState>),
        optionsLocal: {
          schemaVersion: optionsLocalPartial.schemaVersion ?? SCHEMA_VERSION,
          customCss:
            typeof optionsLocalPartial.customCss === 'string' ? optionsLocalPartial.customCss : '',
          dismissedUpdateVersion:
            typeof optionsLocalPartial.dismissedUpdateVersion === 'string'
              ? optionsLocalPartial.dismissedUpdateVersion
              : '',
        },
      },
    };
  } catch (err) {
    return { ok: false, error: `Invalid backup: ${(err as Error).message}` };
  }
}

export function applySettingsBackupFromJson(deps: SettingsDeps, json: string): boolean {
  const parsed = parseSettingsBackupJson(json);
  if (!parsed.ok) {
    window.alert(parsed.error);
    return false;
  }

  const ok = window.confirm(
    'Import this backup? Your current layout and settings will be replaced.'
  );
  if (!ok) return false;

  deps.setLayoutDirect(parsed.backup.layout);
  deps.setOptionsDirect(parsed.backup.options);
  deps.setOptionsLocalDirect(parsed.backup.optionsLocal);
  deps.rerenderPage();
  deps.refreshPanel();
  return true;
}

export function downloadSettingsBackup(deps: SettingsDeps, textarea: HTMLTextAreaElement): void {
  const json = exportSettingsJson(deps);
  textarea.value = json;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'new-tab-plus-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}
