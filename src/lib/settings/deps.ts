import type { LayoutState, OptionsLocalState, OptionsState } from '../storage/schema';

export const SETTINGS_SECTIONS = ['Bookmarks', 'Widgets', 'Appearance', 'Advanced', 'About'] as const;
export type SettingsSectionName = (typeof SETTINGS_SECTIONS)[number];

export interface SettingsDeps {
  layout: LayoutState;
  options: OptionsState;
  optionsLocal: OptionsLocalState;
  /** Debounced persist - for continuous inputs (typing, slider drags). */
  saveLayout(): void;
  /** Immediate persist - for discrete actions (checkboxes, add/remove buttons). */
  saveLayoutNow(): void;
  saveOptions(): void;
  saveOptionsNow(): void;
  saveOptionsLocal(): void;
  /** Re-renders whichever panel is currently shown - for structural changes
   *  (add/remove widget, import) where the panel's own DOM needs rebuilding. */
  refreshPanel(): void;
  /** Rebuild the new tab page (e.g. top bar order changed). */
  rerenderPage(): void;
  /** Rebind folder expand/collapse handlers without rebuilding the grid. */
  rebindGridInteractions(): void;
  /** Persist any debounced settings/layout writes immediately. */
  flushPendingSaves(): void;
  /** Persist widget settings and refresh the live top bar. */
  saveWidgetSettings(widgetId: string, partial: Record<string, unknown>): void;
  /** Rebuild bookmark columns from Chrome — one folder per column, default order. */
  resetBookmarkLayout(): void;
  setLayoutDirect(layout: LayoutState): void;
  setOptionsDirect(options: OptionsState): void;
  setOptionsLocalDirect(optionsLocal: OptionsLocalState): void;
  onCheckForUpdatesChange?(enabled: boolean): void;
}
