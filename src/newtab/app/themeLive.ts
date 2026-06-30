import { applyBackground, applyCustomCss, applyGeneralOptions, applyTheme } from '../../lib/theme/themeEngine';
import { applyTopBar } from '../../lib/topBar/topBarLayout';
import { appState } from './state';

export function applyLiveTheme(): void {
  applyTheme(appState.optionsState.theme, appState.optionsState.background);
  applyBackground(
    appState.optionsState.background,
    appState.optionsState.theme.colors.background
  );
  applyTopBar(appState.optionsState.topBar);
  applyGeneralOptions(appState.optionsState.general);
}

export function applyLiveCustomCss(): void {
  applyCustomCss(appState.optionsLocalState.customCss);
}
