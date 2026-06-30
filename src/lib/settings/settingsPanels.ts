import { renderAboutPanel } from '../about/renderAboutPanel';
import { renderAdvancedPanel } from './advancedPanel';
import { renderAppearancePanel } from './appearancePanel';
import { renderBookmarksPanel } from './bookmarksPanel';
import type { SettingsDeps, SettingsSectionName } from './deps';
import { renderTopBarSettingsPanel } from './widgetsPanel';

export type { SettingsDeps, SettingsSectionName } from './deps';
export { SETTINGS_SECTIONS } from './deps';

export function renderSettingsPanel(name: SettingsSectionName, container: HTMLElement, deps: SettingsDeps): void {
  switch (name) {
    case 'Bookmarks':
      renderBookmarksPanel(container, deps);
      break;
    case 'Widgets':
      renderTopBarSettingsPanel(container, deps);
      break;
    case 'Appearance':
      renderAppearancePanel(container, deps);
      break;
    case 'Advanced':
      renderAdvancedPanel(container, deps);
      break;
    case 'About':
      renderAboutPanel(container, deps);
      break;
  }
}
