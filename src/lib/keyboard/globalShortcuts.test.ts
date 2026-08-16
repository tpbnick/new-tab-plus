import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachGlobalShortcuts } from './globalShortcuts';

describe('attachGlobalShortcuts', () => {
  let detach: () => void;

  beforeEach(() => {
    document.body.innerHTML = '<button id="focus-me">Page</button>';
  });

  afterEach(() => {
    detach?.();
    document.body.innerHTML = '';
  });

  it('opens settings on ?', () => {
    const openSettings = vi.fn();
    detach = attachGlobalShortcuts({
      openSettings,
      isSettingsOpen: () => false,
      isCommandPaletteOpen: () => false,
    });

    document.getElementById('focus-me')?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));

    expect(openSettings).toHaveBeenCalledOnce();
  });

  it('does not open settings while typing in a field', () => {
    const openSettings = vi.fn();
    detach = attachGlobalShortcuts({
      openSettings,
      isSettingsOpen: () => false,
      isCommandPaletteOpen: () => false,
    });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('does not open settings when settings are already open', () => {
    const openSettings = vi.fn();
    detach = attachGlobalShortcuts({
      openSettings,
      isSettingsOpen: () => true,
      isCommandPaletteOpen: () => false,
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('does not open settings when the command palette is open', () => {
    const openSettings = vi.fn();
    detach = attachGlobalShortcuts({
      openSettings,
      isSettingsOpen: () => false,
      isCommandPaletteOpen: () => true,
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(openSettings).not.toHaveBeenCalled();
  });
});
