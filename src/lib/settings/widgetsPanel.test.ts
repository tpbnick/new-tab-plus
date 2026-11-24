import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerBuiltinWidgets } from '../../widgets/registerAll';
import {
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
} from '../storage/schema';
import { setBuiltinWidgetEnabled } from '../widgets/widgetLayout';
import type { SettingsDeps } from './deps';
import { renderTopBarSettingsPanel } from './widgetsPanel';

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

describe('renderTopBarSettingsPanel', () => {
  beforeEach(() => {
    registerBuiltinWidgets();
  });

  it('swaps adjacent enabled top-bar items across a hidden disabled item on a single click', () => {
    const deps = makeDeps();
    deps.options.topBar.itemOrder = ['search', 'clock', 'weather'];
    deps.options.topBar.searchEnabled = true;
    setBuiltinWidgetEnabled(deps.layout, 'clock', false);
    setBuiltinWidgetEnabled(deps.layout, 'weather', true);

    const container = document.createElement('div');
    renderTopBarSettingsPanel(container, deps);

    const enabledRows = [
      ...container.querySelectorAll<HTMLElement>(
        '.options-topbar-order__item:not(.options-topbar-order__item--disabled)'
      ),
    ];
    expect(enabledRows.map((r) => r.querySelector('span')?.textContent)).toEqual([
      'Search bar',
      'Weather',
    ]);

    const searchUpBtn = enabledRows[0].querySelector<HTMLButtonElement>('button[title="Move left"]')!;
    const weatherUpBtn = enabledRows[1].querySelector<HTMLButtonElement>('button[title="Move left"]')!;
    const weatherDownBtn = enabledRows[1].querySelector<HTMLButtonElement>('button[title="Move right"]')!;

    expect(searchUpBtn.disabled).toBe(true);
    expect(weatherUpBtn.disabled).toBe(false);
    expect(weatherDownBtn.disabled).toBe(true);

    weatherUpBtn.click();

    expect(deps.options.topBar.itemOrder).toEqual(['weather', 'clock', 'search']);
    expect(deps.saveOptionsNow).toHaveBeenCalledTimes(1);
    expect(deps.rerenderPage).toHaveBeenCalledTimes(1);
    expect(deps.refreshPanel).toHaveBeenCalledTimes(1);
  });
});
