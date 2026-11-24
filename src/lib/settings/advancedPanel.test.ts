import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
} from '../storage/schema';
import { renderAdvancedPanel } from './advancedPanel';
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
    saveLayoutToCloud: vi.fn(async () => {}),
    restoreLayoutFromCloud: vi.fn(async () => true),
    ...overrides,
  };
}

describe('renderAdvancedPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('does not call saveOptionsLocal on initial mount when opening Advanced panel', () => {
    const deps = makeDeps();
    deps.optionsLocal.customCss = '.column { color: red; }';
    const container = document.createElement('div');
    renderAdvancedPanel(container, deps);

    expect(deps.saveOptionsLocal).not.toHaveBeenCalled();
  });

  it('cancels pending CSS validation timer when user introduces an unbalanced brace', () => {
    const deps = makeDeps();
    const container = document.createElement('div');
    renderAdvancedPanel(container, deps);

    const textareas = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')];
    const cssTextarea = textareas.find((t) => !t.readOnly)!;
    const errorEl = container.querySelector<HTMLElement>('.options-field-error')!;

    // Type balanced CSS (starts 400ms timer)
    cssTextarea.value = '.column { color: red; }';
    cssTextarea.dispatchEvent(new Event('input'));

    // Before 400ms elapses, break braces
    vi.advanceTimersByTime(200);
    cssTextarea.value = '.column { color: red;';
    cssTextarea.dispatchEvent(new Event('input'));
    expect(errorEl.classList.contains('is-visible')).toBe(true);

    // Advance past original 400ms timer: must NOT save or clear the brace error
    vi.advanceTimersByTime(500);
    expect(errorEl.classList.contains('is-visible')).toBe(true);
    expect(deps.saveOptionsLocal).not.toHaveBeenCalled();
  });

  it('preserves cloud restore confirmation message across refreshPanel()', async () => {
    const origConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    try {
      const container = document.createElement('div');
      const deps = makeDeps({
        restoreLayoutFromCloud: vi.fn(async () => true),
        refreshPanel: vi.fn(() => {
          container.replaceChildren();
          renderAdvancedPanel(container, deps);
        }),
      });

      renderAdvancedPanel(container, deps);

      const restoreBtn = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
        (btn) => btn.textContent === 'Restore from cloud'
      )!;
      restoreBtn.click();

      await vi.advanceTimersByTimeAsync(0);

      const status = container.querySelector<HTMLElement>('[role="status"]');
      expect(deps.refreshPanel).toHaveBeenCalledTimes(1);
      expect(status?.textContent).toBe(
        'Restored the layout and settings saved to your Google account.'
      );
    } finally {
      window.confirm = origConfirm;
    }
  });
});
