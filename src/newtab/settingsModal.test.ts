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
    saveLayoutToCloud: vi.fn(),
    restoreLayoutFromCloud: vi.fn(),
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

  it('opens, renders the default section, and closes with Escape', async () => {
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
    await Promise.resolve();

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

  it('closes from the close button', async () => {
    const deps = makeSettingsDeps();
    const modal = createSettingsModal(deps);
    document.body.appendChild(modal.element);
    modal.toggle();
    expect(modal.element.hidden).toBe(false);

    document.querySelector<HTMLButtonElement>('.settings-modal__close')?.click();
    await Promise.resolve();
    expect(modal.element.hidden).toBe(true);
  });

  it('applies stored panel width on open and preserves it across window resize while closed', async () => {
    const store = new Map<string, string>([['new-tab-plus:settings-panel-width', '820']]);
    const originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true });
    try {
      const deps = makeSettingsDeps();
      const modal = createSettingsModal(deps);
      document.body.appendChild(modal.element);

      // Before open, hidden element must not get NaNpx width.
      expect(modal.element.style.width).not.toContain('NaN');

      modal.open();
      expect(modal.element.style.width).toBe('820px');

      await modal.close();
      // Window resize while closed must not clamp the stored width down to 0/min.
      window.dispatchEvent(new Event('resize'));
      modal.open();
      expect(modal.element.style.width).toBe('820px');
    } finally {
      if (originalStorage) {
        Object.defineProperty(window, 'localStorage', originalStorage);
      } else {
        delete (window as unknown as Record<string, unknown>).localStorage;
      }
    }
  });
});
