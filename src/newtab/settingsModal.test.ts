import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
} from '../lib/storage/schema';
import type { SettingsDeps } from '../lib/settings/settingsPanels';
import { createSettingsModal } from './settingsModal';

function makeSettingsDeps(overrides: Partial<SettingsDeps> = {}): SettingsDeps {
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
    ...overrides,
  };
}

describe('createSettingsModal integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="page-trigger">Settings</button>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens, renders the default section, and closes with Escape', () => {
    const deps = makeSettingsDeps();
    const modal = createSettingsModal(deps);
    document.body.appendChild(modal.element);

    const trigger = document.getElementById('page-trigger') as HTMLButtonElement;
    trigger.focus();
    modal.open();

    expect(modal.element.hidden).toBe(false);
    expect(document.querySelector('#settings-modal-title')?.textContent).toBe('Settings');
    expect(document.querySelector('.settings-modal__nav button.active')?.textContent).toBe(
      'Bookmarks'
    );
    expect(document.querySelector('.settings-modal__content')?.children.length).toBeGreaterThan(0);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(modal.element.hidden).toBe(true);
    expect(deps.flushPendingSaves).toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('switches sections from the nav', () => {
    const deps = makeSettingsDeps();
    const modal = createSettingsModal(deps);
    document.body.appendChild(modal.element);
    modal.open();

    const appearanceBtn = [...document.querySelectorAll<HTMLButtonElement>('.settings-modal__nav button')].find(
      (btn) => btn.textContent === 'Appearance'
    );
    appearanceBtn?.click();

    expect(document.querySelector('.settings-modal__nav button.active')?.textContent).toBe('Appearance');
  });

  it('closes from the close button', () => {
    const deps = makeSettingsDeps();
    const modal = createSettingsModal(deps);
    document.body.appendChild(modal.element);
    modal.toggle();
    expect(modal.element.hidden).toBe(false);

    document.querySelector<HTMLButtonElement>('.settings-modal__close')?.click();
    expect(modal.element.hidden).toBe(true);
  });
});
