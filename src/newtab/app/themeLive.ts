import { resolveBackgroundImageUrl } from '../../lib/theme/colorUtils';
import { applyBackground, applyCustomCss, applyGeneralOptions, applyTheme } from '../../lib/theme/themeEngine';
import { applyTopBar } from '../../lib/topBar/topBarLayout';
import { appState } from './state';

function resolvedBackground() {
  return {
    ...appState.optionsState.background,
    imageUrl: resolveBackgroundImageUrl(
      appState.optionsState.background,
      appState.optionsLocalState.uploadedBackgroundImage
    ),
  };
}

export function applyLiveTheme(): void {
  const background = resolvedBackground();
  applyTheme(appState.optionsState.theme, background);
  applyBackground(background, appState.optionsState.theme.colors.background);
  applyTopBar(appState.optionsState.topBar);
  applyGeneralOptions(appState.optionsState.general);
}

export function applyLiveCustomCss(): void {
  applyCustomCss(appState.optionsLocalState.customCss);
}
