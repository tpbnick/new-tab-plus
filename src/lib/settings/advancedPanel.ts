import { validateCustomCss } from '../theme/themeEngine';
import { checkBalancedBraces } from '../theme/customCssValidate';
import {
  applySettingsBackupFromJson,
  downloadSettingsBackup,
  exportSettingsJson,
} from './backup';
import { collapsibleSection } from './collapsibleSection';
import type { SettingsDeps } from './deps';

function renderImportExportPanel(container: HTMLElement, deps: SettingsDeps): void {
  const help = document.createElement('p');
  help.className = 'options-help';
  help.textContent =
    'Export your layout and settings as JSON. Download a backup file or import one to restore.';

  const jsonWrap = document.createElement('div');
  jsonWrap.className = 'options-json-wrap';

  const textarea = document.createElement('textarea');
  textarea.className = 'options-json';
  textarea.value = exportSettingsJson(deps);
  textarea.setAttribute('aria-label', 'Settings backup JSON');
  textarea.spellcheck = false;
  textarea.readOnly = true;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'options-json-copy';
  copyBtn.setAttribute('aria-label', 'Copy JSON');
  const copyIconSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const copiedIconSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  copyBtn.innerHTML = copyIconSvg;

  let copyResetTimer: number | undefined;

  const showCopyAck = (): void => {
    window.clearTimeout(copyResetTimer);
    copyBtn.classList.add('is-copied');
    copyBtn.setAttribute('aria-label', 'Copied to clipboard');
    copyBtn.innerHTML = copiedIconSvg;
    copyResetTimer = window.setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      copyBtn.setAttribute('aria-label', 'Copy JSON');
      copyBtn.innerHTML = copyIconSvg;
    }, 2000);
  };

  copyBtn.addEventListener('click', () => {
    const json = exportSettingsJson(deps);
    textarea.value = json;
    void navigator.clipboard
      .writeText(json)
      .then(showCopyAck)
      .catch(() => {
        textarea.select();
        document.execCommand('copy');
        showCopyAck();
      });
  });

  jsonWrap.append(textarea, copyBtn);

  const actions = document.createElement('div');
  actions.className = 'options-actions';

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.textContent = 'Download backup';
  downloadBtn.addEventListener('click', () => downloadSettingsBackup(deps, textarea));

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.textContent = 'Import backup';
  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        if (applySettingsBackupFromJson(deps, text)) {
          textarea.value = text;
        }
      })
      .finally(() => {
        fileInput.value = '';
      });
  });

  actions.append(downloadBtn, importBtn);
  container.append(help, jsonWrap, fileInput, actions);
}

export function renderAdvancedPanel(container: HTMLElement, deps: SettingsDeps): void {
  container.appendChild(
    collapsibleSection('advanced-import', 'Import / export', (body) => {
      renderImportExportPanel(body, deps);
    })
  );
  container.appendChild(
    collapsibleSection('advanced-css', 'Custom CSS', (body) => {
      const textarea = document.createElement('textarea');
      textarea.className = 'options-json';
      textarea.value = deps.optionsLocal.customCss;
      textarea.placeholder = '.column { /* your custom styles */ }';
      textarea.spellcheck = false;

      const error = document.createElement('p');
      error.className = 'options-field-error';
      error.setAttribute('role', 'alert');

      let validateTimer: number | undefined;

      const showValidationError = (message: string): void => {
        error.textContent = message;
        error.classList.add('is-visible');
        textarea.classList.add('options-json--invalid');
        textarea.setAttribute('aria-invalid', 'true');
      };

      const clearValidationError = (): void => {
        error.classList.remove('is-visible');
        error.textContent = '';
        textarea.classList.remove('options-json--invalid');
        textarea.removeAttribute('aria-invalid');
      };

      const applyValidCss = (): void => {
        const validation = validateCustomCss(textarea.value);
        if (!validation.ok) {
          showValidationError(validation.message);
          return;
        }

        clearValidationError();
        deps.optionsLocal.customCss = textarea.value;
        deps.saveOptionsLocal();
      };

      const syncCustomCss = (): void => {
        const braceError = checkBalancedBraces(textarea.value);
        if (braceError) {
          showValidationError(braceError);
          return;
        }

        window.clearTimeout(validateTimer);
        validateTimer = window.setTimeout(applyValidCss, 400);
      };

      textarea.addEventListener('input', syncCustomCss);
      textarea.addEventListener('blur', () => {
        window.clearTimeout(validateTimer);
        applyValidCss();
      });
      applyValidCss();
      body.append(textarea, error);
    })
  );
}
