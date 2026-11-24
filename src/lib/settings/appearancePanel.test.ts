import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
} from '../storage/schema';
import { THEME_PRESET_CUSTOM_ID } from '../theme/presets';
import { renderAppearancePanel } from './appearancePanel';
import type { SettingsDeps } from './deps';

function makeDeps(overrides: Partial<SettingsDeps> = {}): SettingsDeps {
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
    saveLayoutToCloud: vi.fn(),
    restoreLayoutFromCloud: vi.fn(),
    ...overrides,
  };
}

function findRowControl<T extends HTMLElement>(container: HTMLElement, labelText: string): T {
  const rows = [...container.querySelectorAll<HTMLElement>('.options-row')];
  const row = rows.find((el) => el.querySelector('span')?.textContent === labelText);
  if (!row) throw new Error(`Row not found: ${labelText}`);
  const control = row.querySelector<T>('input, select');
  if (!control) throw new Error(`Control not found in row: ${labelText}`);
  return control;
}

describe('renderAppearancePanel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('captures new theme value in customSnapshot and syncs Theme preset dropdown to custom', () => {
    const deps = makeDeps();
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderAppearancePanel(container, deps);

    const presetSelect = findRowControl<HTMLSelectElement>(container, 'Theme');
    expect(presetSelect.value).toBe('night-dark');

    const textColorInput = findRowControl<HTMLInputElement>(container, 'Text color');
    textColorInput.value = '#ff00aa';
    textColorInput.dispatchEvent(new Event('input'));

    expect(deps.options.theme.colors.text).toBe('#ff00aa');
    expect(deps.options.theme.customSnapshot.colors.text).toBe('#ff00aa');
    expect(deps.options.theme.presetId).toBe(THEME_PRESET_CUSTOM_ID);
    expect(presetSelect.value).toBe(THEME_PRESET_CUSTOM_ID);
  });

  it('updates background-dependent controls in place while typing URL without calling refreshPanel', () => {
    const deps = makeDeps();
    deps.options.theme.autoTextColor = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderAppearancePanel(container, deps);

    const urlInput = findRowControl<HTMLInputElement>(container, 'Image URL');
    const textColorInput = findRowControl<HTMLInputElement>(container, 'Text color');
    const opacityRow = [...container.querySelectorAll<HTMLElement>('.options-row')].find(
      (el) => el.querySelector('span')?.textContent === 'Image opacity'
    )!;

    expect(textColorInput.disabled).toBe(true);
    expect(opacityRow.hidden).toBe(true);

    urlInput.focus();
    urlInput.value = 'https://example.com/bg.jpg';
    urlInput.dispatchEvent(new Event('input'));

    expect(deps.refreshPanel).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(urlInput);
    expect(opacityRow.hidden).toBe(false);
    expect(textColorInput.disabled).toBe(false);

    // Clearing the URL restores hidden opacity row and disabled text color in place
    urlInput.value = '';
    urlInput.dispatchEvent(new Event('input'));
    expect(deps.refreshPanel).not.toHaveBeenCalled();
    expect(opacityRow.hidden).toBe(true);
    expect(textColorInput.disabled).toBe(true);
  });

  it('handles uppercase DATA:IMAGE/ URIs case-insensitively', () => {
    const deps = makeDeps();
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderAppearancePanel(container, deps);

    const urlInput = findRowControl<HTMLInputElement>(container, 'Image URL');
    urlInput.value = 'DATA:IMAGE/PNG;base64,iVBORw0KGgo=';
    urlInput.dispatchEvent(new Event('input'));

    expect(deps.optionsLocal.uploadedBackgroundImage).toBe('DATA:IMAGE/PNG;base64,iVBORw0KGgo=');
    expect(deps.options.background.imageUrl).toBe('');
    expect(deps.saveOptionsLocal).toHaveBeenCalled();
    expect(deps.refreshPanel).toHaveBeenCalled();
  });
});
