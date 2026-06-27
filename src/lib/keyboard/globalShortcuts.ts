import { isTypingTarget } from './typingTarget';

export interface GlobalShortcutHandlers {
  openSettings(): void;
  isSettingsOpen(): boolean;
  isCommandPaletteOpen(): boolean;
}

/** Document-level shortcuts that should not fire while typing or in overlays. */
export function attachGlobalShortcuts(handlers: GlobalShortcutHandlers): () => void {
  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== '?') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    if (handlers.isSettingsOpen() || handlers.isCommandPaletteOpen()) return;
    if (document.body.classList.contains('is-folder-dragging')) return;

    event.preventDefault();
    handlers.openSettings();
  }

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
