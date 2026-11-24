import { FONT_FAMILY_OPTIONS, resolveFontFamilyValue } from '../theme/fontFamilies';
import {
  applyCustomThemeSnapshot,
  applyThemePreset,
  detectThemePresetId,
  getThemePreset,
  saveCustomThemeSnapshot,
  THEME_PRESET_CUSTOM_ID,
  themePresetChoices,
} from '../theme/presets';
import { hasBackgroundImage } from '../theme/colorUtils';
import {
  LINK_HOVER_GROW_PCT_MAX,
  LINK_HOVER_GROW_PCT_MIN,
  linkHoverEffectChoices,
  normalizeLinkHoverEffect,
} from '../theme/linkHover';
import type { OptionsState } from '../storage/schema';
import {
  createCheckboxInput as checkbox,
  createNormalizedColorInput as colorInput,
  createOptionsRow as row,
  createRangeRow as rangeRow,
  createRgbaColorInput as rgbaColorInput,
  createSelectInput as selectInput,
  createTextInput as textInput,
} from '../ui/formControls';
import { isSafeBackgroundUrl, validateBackgroundImageUrl } from '../urlSafety';
import { collapsibleSection } from './collapsibleSection';
import type { SettingsDeps } from './deps';

const FONT_SIZE_MIN_PX = 10;
const FONT_SIZE_MAX_PX = 32;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

interface AppearanceUiSync {
  setPresetSelect(el: HTMLSelectElement): void;
  markThemeCustom(): void;
  registerBgDependentSync(fn: () => void): void;
  syncBgDependent(): void;
}

function createAppearanceUiSync(deps: SettingsDeps): AppearanceUiSync {
  let presetSelect: HTMLSelectElement | null = null;
  const bgSyncCallbacks: Array<() => void> = [];

  return {
    setPresetSelect(el) {
      presetSelect = el;
    },
    markThemeCustom() {
      saveCustomThemeSnapshot(deps.options.theme);
      if (presetSelect) {
        presetSelect.value = THEME_PRESET_CUSTOM_ID;
      }
    },
    registerBgDependentSync(fn) {
      bgSyncCallbacks.push(fn);
    },
    syncBgDependent() {
      for (const fn of bgSyncCallbacks) fn();
    },
  };
}

function renderThemePresetPicker(
  container: HTMLElement,
  deps: SettingsDeps,
  ui: AppearanceUiSync
): void {
  const help = document.createElement('p');
  help.className = 'options-help';
  help.textContent = 'Presets change fonts and colors only.';
  container.appendChild(help);

  const presetSelect = selectInput(
    detectThemePresetId(deps.options.theme),
    themePresetChoices(),
    (id) => {
      if (id === THEME_PRESET_CUSTOM_ID) {
        applyCustomThemeSnapshot(deps.options.theme);
        deps.saveOptionsNow();
        deps.refreshPanel();
        return;
      }
      const preset = getThemePreset(id);
      if (!preset) return;
      if (deps.options.theme.presetId === THEME_PRESET_CUSTOM_ID) {
        saveCustomThemeSnapshot(deps.options.theme);
      }
      applyThemePreset(deps.options.theme, preset);
      deps.saveOptionsNow();
      deps.refreshPanel();
    },
    'options-select--wide'
  );
  ui.setPresetSelect(presetSelect);

  container.appendChild(row('Theme', presetSelect));
}

function renderThemePanel(
  container: HTMLElement,
  deps: SettingsDeps,
  ui: AppearanceUiSync
): void {
  container.appendChild(
    row(
      'Font family',
      selectInput(
        resolveFontFamilyValue(deps.options.theme.fontFamily),
        FONT_FAMILY_OPTIONS,
        (v) => {
          deps.options.theme.fontFamily = v;
          ui.markThemeCustom();
          deps.saveOptionsNow();
        },
        'options-select--wide'
      )
    )
  );
  container.appendChild(
    rangeRow(
      'Font weight',
      deps.options.theme.fontWeight,
      (v) => {
        deps.options.theme.fontWeight = v;
        ui.markThemeCustom();
        deps.saveOptions();
      },
      300,
      800,
      100
    )
  );
  container.appendChild(
    rangeRow(
      'Font size',
      deps.options.theme.fontSizePx,
      (v) => {
        deps.options.theme.fontSizePx = v;
        deps.saveOptions();
      },
      FONT_SIZE_MIN_PX,
      FONT_SIZE_MAX_PX,
      1,
      'px'
    )
  );
  container.appendChild(
    row(
      'Uppercase folder names',
      checkbox(deps.options.theme.uppercaseFolderNames, (v) => {
        deps.options.theme.uppercaseFolderNames = v;
        deps.saveOptionsNow();
      })
    )
  );
  container.appendChild(
    row(
      'Background color',
      colorInput(deps.options.theme.colors.background, (v) => {
        deps.options.theme.colors.background = v;
        ui.markThemeCustom();
        deps.saveOptions();
      })
    )
  );
  container.appendChild(
    row(
      'Auto text color from background',
      checkbox(deps.options.theme.autoTextColor, (v) => {
        deps.options.theme.autoTextColor = v;
        ui.markThemeCustom();
        deps.saveOptionsNow();
        deps.refreshPanel();
      })
    )
  );
  const autoHelp = document.createElement('p');
  autoHelp.className = 'options-help';
  autoHelp.textContent =
    'Auto text color only applies when no background image is set. With an image, use Text color below.';
  container.appendChild(autoHelp);

  const textColorControl = colorInput(deps.options.theme.colors.text, (v) => {
    deps.options.theme.colors.text = v;
    ui.markThemeCustom();
    deps.saveOptions();
  });

  const syncAutoTextUi = (): void => {
    const hasImage = hasBackgroundImage(
      deps.options.background,
      deps.optionsLocal.uploadedBackgroundImage
    );
    autoHelp.hidden = !hasImage;
    const autoTextActive = deps.options.theme.autoTextColor && !hasImage;
    textColorControl.disabled = autoTextActive;
    textColorControl.title = autoTextActive
      ? 'Disabled while auto text color is on and no background image is set'
      : '';
  };
  syncAutoTextUi();
  ui.registerBgDependentSync(syncAutoTextUi);

  container.appendChild(row('Text color', textColorControl));
  container.appendChild(
    rangeRow(
      'Text visibility',
      deps.options.theme.textOpacityPct,
      (v) => {
        deps.options.theme.textOpacityPct = v;
        deps.saveOptions();
      },
      30,
      100,
      5,
      '%'
    )
  );
  container.appendChild(
    row(
      'Highlight color',
      colorInput(deps.options.theme.colors.highlight, (v) => {
        deps.options.theme.colors.highlight = v;
        ui.markThemeCustom();
        deps.saveOptions();
      })
    )
  );
  container.appendChild(
    row(
      'Use highlight color for folder headers',
      checkbox(deps.options.theme.useHighlightForFolderHeaders, (v) => {
        deps.options.theme.useHighlightForFolderHeaders = v;
        deps.saveOptionsNow();
        deps.refreshPanel();
      })
    )
  );
  const folderHeaderColorControl = colorInput(deps.options.theme.folderHeaderColor, (v) => {
    deps.options.theme.folderHeaderColor = v;
    deps.saveOptions();
  });
  if (deps.options.theme.useHighlightForFolderHeaders) {
    folderHeaderColorControl.disabled = true;
    folderHeaderColorControl.title = 'Disabled while folder headers use the highlight color';
  }
  container.appendChild(row('Folder header color', folderHeaderColorControl));
  container.appendChild(
    row(
      'Border color',
      rgbaColorInput(deps.options.theme.colors.shadow, (v) => {
        deps.options.theme.colors.shadow = v;
        ui.markThemeCustom();
        deps.saveOptions();
      })
    )
  );
  container.appendChild(
    rangeRow(
      'Spacing',
      deps.options.theme.spacing,
      (v) => {
        deps.options.theme.spacing = v;
        deps.saveOptions();
      },
      0.5,
      3,
      0.1
    )
  );
  container.appendChild(
    rangeRow(
      'Column width (max, px)',
      deps.options.theme.columnWidth,
      (v) => {
        deps.options.theme.columnWidth = v;
        deps.saveOptions();
      },
      100,
      400,
      10,
      'px'
    )
  );
  container.appendChild(
    rangeRow(
      'Space from top of screen',
      deps.options.theme.topSpacingPx,
      (v) => {
        deps.options.theme.topSpacingPx = v;
        deps.saveOptions();
      },
      0,
      120,
      4,
      'px'
    )
  );
  container.appendChild(
    rangeRow(
      'Gap between regions',
      deps.options.theme.regionGapPx,
      (v) => {
        deps.options.theme.regionGapPx = v;
        deps.saveOptions();
      },
      0,
      100,
      4,
      'px'
    )
  );
}

function renderLinkHoverPanel(container: HTMLElement, deps: SettingsDeps): void {
  const help = document.createElement('p');
  help.className = 'options-help';
  help.textContent =
    'Applies to bookmark and section links. Grow uses transform so row spacing stays the same.';
  container.appendChild(help);

  const effect = normalizeLinkHoverEffect(deps.options.theme.linkHoverEffect);

  container.appendChild(
    row(
      'Hover effect',
      selectInput(
        effect,
        linkHoverEffectChoices(),
        (v) => {
          deps.options.theme.linkHoverEffect = normalizeLinkHoverEffect(v);
          deps.saveOptionsNow();
          deps.refreshPanel();
        },
        'options-select--wide'
      )
    )
  );

  if (effect === 'grow') {
    container.appendChild(
      rangeRow(
        'Grow amount',
        deps.options.theme.linkHoverGrowPct,
        (v) => {
          deps.options.theme.linkHoverGrowPct = v;
          deps.saveOptions();
        },
        LINK_HOVER_GROW_PCT_MIN,
        LINK_HOVER_GROW_PCT_MAX,
        5,
        '%'
      )
    );
  }

  if (effect !== 'none') {
    container.appendChild(
      rangeRow(
        'Animation speed',
        deps.options.theme.linkHoverDurationMs,
        (v) => {
          deps.options.theme.linkHoverDurationMs = v;
          deps.saveOptions();
        },
        80,
        500,
        10,
        'ms'
      )
    );
  }
}

function renderBackgroundPanel(
  container: HTMLElement,
  deps: SettingsDeps,
  ui: AppearanceUiSync
): void {
  const urlError = document.createElement('p');
  urlError.className = 'options-field-error';
  urlError.setAttribute('role', 'alert');

  let removeBtn: HTMLButtonElement | null = null;

  const urlInput = textInput(deps.options.background.imageUrl, (v) => {
    const validation = validateBackgroundImageUrl(v);
    if (!validation.ok) {
      urlError.textContent = validation.message;
      urlError.classList.add('is-visible');
      urlInput.classList.add('options-json--invalid');
      urlInput.setAttribute('aria-invalid', 'true');
      return;
    }
    urlError.classList.remove('is-visible');
    urlError.textContent = '';
    urlInput.classList.remove('options-json--invalid');
    urlInput.removeAttribute('aria-invalid');
    if (/^data:image\//i.test(v.trim())) {
      deps.optionsLocal.uploadedBackgroundImage = v.trim();
      deps.options.background.imageUrl = '';
      deps.saveOptionsLocal();
      deps.saveOptions();
      deps.refreshPanel();
      return;
    }
    deps.options.background.imageUrl = v;
    if (v.trim() && deps.optionsLocal.uploadedBackgroundImage) {
      deps.optionsLocal.uploadedBackgroundImage = '';
      deps.saveOptionsLocal();
      removeBtn?.remove();
      removeBtn = null;
    }
    deps.saveOptions();
    ui.syncBgDependent();
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  fileInput.hidden = true;

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.textContent = 'Upload image';
  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      urlError.textContent = 'Image must be 4 MB or smaller.';
      urlError.classList.add('is-visible');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!isSafeBackgroundUrl(result)) {
        urlError.textContent = 'File must be a raster image (PNG, JPEG, WebP, or GIF).';
        urlError.classList.add('is-visible');
        return;
      }
      urlError.classList.remove('is-visible');
      urlError.textContent = '';
      deps.optionsLocal.uploadedBackgroundImage = result;
      deps.options.background.imageUrl = '';
      deps.saveOptionsLocal();
      deps.saveOptions();
      deps.refreshPanel();
    };
    reader.readAsDataURL(file);
  });

  const uploadActions = document.createElement('div');
  uploadActions.className = 'options-actions';
  uploadActions.appendChild(uploadBtn);
  if (deps.optionsLocal.uploadedBackgroundImage) {
    removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove uploaded image';
    removeBtn.addEventListener('click', () => {
      deps.optionsLocal.uploadedBackgroundImage = '';
      deps.saveOptionsLocal();
      deps.refreshPanel();
    });
    uploadActions.appendChild(removeBtn);
  }

  const uploadHelp = document.createElement('p');
  uploadHelp.className = 'options-help';
  uploadHelp.textContent =
    'Uploaded images stay on this device and are not included when you save to cloud.';

  container.appendChild(row('Image URL', urlInput));
  container.appendChild(urlError);
  container.append(uploadActions, uploadHelp);

  const opacityRow = rangeRow(
    'Image opacity',
    deps.options.background.imageOpacityPct,
    (v) => {
      deps.options.background.imageOpacityPct = v;
      deps.saveOptions();
    },
    0,
    100,
    5,
    '%'
  );
  const opacityHelp = document.createElement('p');
  opacityHelp.className = 'options-help';
  opacityHelp.textContent =
    'Lower opacity fades the image toward your background color so bookmarks stay readable.';
  container.append(opacityRow, opacityHelp);

  const syncOpacityUi = (): void => {
    const hasImage = hasBackgroundImage(
      deps.options.background,
      deps.optionsLocal.uploadedBackgroundImage
    );
    opacityRow.hidden = !hasImage;
    opacityHelp.hidden = !hasImage;
  };
  syncOpacityUi();
  ui.registerBgDependentSync(syncOpacityUi);

  container.appendChild(
    row(
      'Size',
      selectInput(
        deps.options.background.size,
        [
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
          { value: 'repeat', label: 'Repeat' },
          { value: 'auto', label: 'Auto' },
        ],
        (v) => {
          deps.options.background.size = v as OptionsState['background']['size'];
          deps.saveOptions();
        }
      )
    )
  );
  container.appendChild(
    row(
      'Alignment',
      selectInput(
        deps.options.background.align,
        [
          { value: 'center', label: 'Center' },
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'top left', label: 'Top left' },
          { value: 'top right', label: 'Top right' },
          { value: 'bottom left', label: 'Bottom left' },
          { value: 'bottom right', label: 'Bottom right' },
        ],
        (v) => {
          deps.options.background.align = v;
          deps.saveOptions();
        }
      )
    )
  );
}

export function renderAppearancePanel(container: HTMLElement, deps: SettingsDeps): void {
  const ui = createAppearanceUiSync(deps);
  container.appendChild(
    collapsibleSection('appearance-theme', 'Theme', (body) => {
      renderThemePresetPicker(body, deps, ui);
    })
  );
  container.appendChild(
    collapsibleSection('appearance-text', 'Text & colors', (body) => {
      renderThemePanel(body, deps, ui);
    })
  );
  container.appendChild(
    collapsibleSection('appearance-link-hover', 'Link hover', (body) => {
      renderLinkHoverPanel(body, deps);
    })
  );
  container.appendChild(
    collapsibleSection('appearance-background', 'Background image', (body) => {
      renderBackgroundPanel(body, deps, ui);
    })
  );
}
