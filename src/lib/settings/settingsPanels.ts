import { SECTION_TITLES } from '../sections';
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
import {
  hasBackgroundImage,
} from '../theme/colorUtils';
import {
  LINK_HOVER_GROW_PCT_MAX,
  LINK_HOVER_GROW_PCT_MIN,
  linkHoverEffectChoices,
  normalizeLinkHoverEffect,
} from '../theme/linkHover';
import { widgetRegistry } from '../../widgets/registry';
import {
  BUILTIN_TOP_BAR_WIDGETS,
  findWidgetColumn,
  isBuiltinWidgetEnabled,
  setBuiltinWidgetEnabled,
} from '../widgets/widgetLayout';
import { appendWidgetSettingsForm } from '../widgets/widgetSettingsForm';
import {
  clampSearchMaxWidthPx,
  moveTopBarItem,
  normalizeTopBarItemOrder,
  SEARCH_MAX_WIDTH_PX,
  TOP_BAR_ITEM_LABELS,
} from '../topBar/topBarLayout';
import { SEARCH_ENGINE_LABELS, SEARCH_ENGINES } from '../search/searchEngine';
import type {
  LayoutState,
  OptionsLocalState,
  OptionsState,
  SpecialSectionMeta,
  TopBarItemId,
} from '../storage/schema';
import { mergeOptionsState, SCHEMA_VERSION } from '../storage/schema';
import { sanitizeLayoutState } from '../storage/layoutNormalize';
import { validateCustomCss } from '../theme/themeEngine';
import { checkBalancedBraces } from '../theme/customCssValidate';
import {
  createCheckboxInput as checkbox,
  createNormalizedColorInput as colorInput,
  createNumberInput as numberInput,
  createOptionsRow as row,
  createRangeRow as rangeRow,
  createRgbaColorInput as rgbaColorInput,
  createSelectInput as selectInput,
  createTextInput as textInput,
} from '../ui/formControls';
import { validateBackgroundImageUrl } from '../urlSafety';
import { renderAboutPanel } from '../about/renderAboutPanel';

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
}

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
      renderAboutPanel(container);
      break;
  }
}

const collapsedSettingsSections = new Map<string, boolean>();

function collapsibleSection(id: string, title: string, build: (body: HTMLElement) => void): HTMLElement {
  const section = document.createElement('section');
  section.className = 'options-collapsible';
  const startCollapsed = collapsedSettingsSections.get(id) ?? false;
  if (startCollapsed) section.classList.add('is-collapsed');

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'options-collapsible__header';
  header.setAttribute('aria-expanded', String(!startCollapsed));

  const chevron = document.createElement('span');
  chevron.className = 'options-collapsible__chevron';
  chevron.setAttribute('aria-hidden', 'true');

  const titleEl = document.createElement('span');
  titleEl.className = 'options-collapsible__title';
  titleEl.textContent = title;

  header.append(titleEl, chevron);

  const body = document.createElement('div');
  body.className = 'options-collapsible__body';
  const inner = document.createElement('div');
  inner.className = 'options-collapsible__inner';
  body.appendChild(inner);
  build(inner);

  header.addEventListener('click', () => {
    const collapsed = section.classList.toggle('is-collapsed');
    header.setAttribute('aria-expanded', String(!collapsed));
    collapsedSettingsSections.set(id, collapsed);
  });

  section.append(header, body);
  return section;
}

// --- form helpers -----------------------------------------------------
//
// Every onChange below reads/writes through `deps` at the moment the
// control fires, never through a value captured when the panel was built.
// `deps.layout`/`deps.options`/`deps.optionsLocal` are live getters in the
// real app (see newtab/main.ts) backed by module-level variables that get
// reassigned to a freshly-deserialized object on every chrome.storage
// round-trip (including round-trips triggered by this panel's own saves).
// Capturing a snapshot at render time would go stale after the very next
// save, silently mutating a detached object that's never persisted - which
// is exactly what happened before this was fixed: the second edit to any
// panel had no visible effect because it mutated a copy nothing read again.

const SECTION_ITEM_MIN = 1;
const SECTION_ITEM_MAX = 30;

function clampSectionItemCount(value: number): number {
  return Math.min(SECTION_ITEM_MAX, Math.max(SECTION_ITEM_MIN, Math.round(value)));
}

function exportSettingsJson(deps: SettingsDeps): string {
  const layout = sanitizeLayoutState(deps.layout);
  return JSON.stringify(
    {
      layout: {
        schemaVersion: layout.schemaVersion,
        columns: layout.columns,
        folderState: layout.folderState,
      },
      options: deps.options,
      optionsLocal: {
        schemaVersion: deps.optionsLocal.schemaVersion,
        customCss: deps.optionsLocal.customCss,
      },
    },
    null,
    2
  );
}

function renderBookmarksPanel(container: HTMLElement, deps: SettingsDeps): void {
  container.appendChild(
    collapsibleSection('bookmarks-behavior', 'Behavior', (body) => {
      body.appendChild(
        row(
          'Remember open folders',
          checkbox(deps.options.general.rememberOpenFolders, (v) => {
            deps.options.general.rememberOpenFolders = v;
            deps.saveOptionsNow();
            deps.rerenderPage();
          })
        )
      );
      body.appendChild(
        row(
          'Expand collapsed folders on hover',
          checkbox(deps.options.general.expandCollapsedOnHover, (v) => {
            deps.options.general.expandCollapsedOnHover = v;
            deps.saveOptionsNow();
            deps.rebindGridInteractions();
          })
        )
      );
      body.appendChild(
        rangeRow(
          'Folder expand/collapse speed',
          deps.options.general.folderCollapseAnimationMs,
          (v) => {
            deps.options.general.folderCollapseAnimationMs = v;
            deps.saveOptions();
          },
          0,
          800,
          25,
          'ms'
        )
      );
      body.appendChild(
        row(
          'Open links in the same tab',
          checkbox(deps.options.general.openLinksInSameTab, (v) => {
            deps.options.general.openLinksInSameTab = v;
            deps.saveOptionsNow();
            deps.rerenderPage();
          })
        )
      );

      const layoutHelp = document.createElement('p');
      layoutHelp.className = 'options-help';
      layoutHelp.textContent =
        'Click a folder or section header to expand or collapse it. Drag headers to rearrange columns unless columns are locked. Your Chrome bookmarks are not changed.';
      body.appendChild(layoutHelp);
    })
  );

  container.appendChild(
    collapsibleSection('bookmarks-sections', 'Sections', (body) => {
      renderSectionsPanel(body, deps);
    })
  );

  container.appendChild(
    collapsibleSection('bookmarks-layout', 'Column layout', (body) => {
      body.appendChild(
        row(
          'Lock columns',
          checkbox(deps.options.general.lockColumns, (v) => {
            deps.options.general.lockColumns = v;
            deps.saveOptionsNow();
            deps.rerenderPage();
          })
        )
      );

      const lockHelp = document.createElement('p');
      lockHelp.className = 'options-help';
      lockHelp.textContent =
        'When locked, folder and section headers cannot be dragged to rearrange columns.';
      body.appendChild(lockHelp);

      const resetHelp = document.createElement('p');
      resetHelp.className = 'options-help';
      resetHelp.textContent = 'Restore the default column layout. Your Chrome bookmarks are not changed.';
      body.appendChild(resetHelp);

      const resetActions = document.createElement('div');
      resetActions.className = 'options-actions';

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.textContent = 'Reset to original layout';
      resetBtn.addEventListener('click', () => {
        const ok = window.confirm(
          'Reset to the original column layout? Your Chrome bookmarks are not changed.'
        );
        if (ok) deps.resetBookmarkLayout();
      });
      resetActions.appendChild(resetBtn);
      body.appendChild(resetActions);
    })
  );
}

function renderTopBarSettingsPanel(container: HTMLElement, deps: SettingsDeps): void {
  container.appendChild(
    collapsibleSection('topbar-main', 'Top bar', (body) => {
      renderTopBarPanel(body, deps);
    })
  );
  container.appendChild(
    collapsibleSection('topbar-widgets', 'Widgets', (body) => {
      renderWidgetsPanel(body, deps);
    })
  );
}

function renderAppearancePanel(container: HTMLElement, deps: SettingsDeps): void {
  container.appendChild(
    collapsibleSection('appearance-theme', 'Theme', (body) => {
      renderThemePresetPicker(body, deps);
    })
  );
  container.appendChild(
    collapsibleSection('appearance-text', 'Text & colors', (body) => {
      renderThemePanel(body, deps);
    })
  );
  container.appendChild(
    collapsibleSection('appearance-link-hover', 'Link hover', (body) => {
      renderLinkHoverPanel(body, deps);
    })
  );
  container.appendChild(
    collapsibleSection('appearance-background', 'Background image', (body) => {
      renderBackgroundPanel(body, deps);
    })
  );
}

function markThemeCustom(deps: SettingsDeps): void {
  saveCustomThemeSnapshot(deps.options.theme);
}

function renderThemePresetPicker(container: HTMLElement, deps: SettingsDeps): void {
  const help = document.createElement('p');
  help.className = 'options-help';
  help.textContent = 'Presets change fonts and colors only.';
  container.appendChild(help);

  container.appendChild(
    row(
      'Theme',
      selectInput(
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
      )
    )
  );
}

function fieldsetTitle(text: string): HTMLHeadingElement {
  const title = document.createElement('h3');
  title.className = 'options-fieldset__title';
  title.textContent = text;
  return title;
}

function renderSectionsPanel(container: HTMLElement, deps: SettingsDeps): void {
  const sections = deps.layout.columns.filter((c): c is SpecialSectionMeta => c.type === 'specialSection');

  function findSection(id: string): SpecialSectionMeta | undefined {
    return deps.layout.columns.find((c): c is SpecialSectionMeta => c.type === 'specialSection' && c.id === id);
  }

  for (const section of sections) {
    const sectionId = section.id;
    const fieldset = document.createElement('div');
    fieldset.className = 'options-fieldset';

    fieldset.appendChild(fieldsetTitle(SECTION_TITLES[section.kind]));

    fieldset.appendChild(
      row(
        'Enabled',
        checkbox(section.enabled, (v) => {
          const current = findSection(sectionId);
          if (current) current.enabled = v;
          deps.saveLayoutNow();
        })
      )
    );

    if (section.kind !== 'apps') {
      const itemLabel = section.kind === 'otherDevices' ? 'Tabs per device' : 'Items to show';
      fieldset.appendChild(
        row(
          itemLabel,
          numberInput(
            clampSectionItemCount(section.itemCount ?? 8),
            (v) => {
              const current = findSection(sectionId);
              if (current) current.itemCount = clampSectionItemCount(v);
              deps.saveLayout();
            },
            { min: SECTION_ITEM_MIN, max: SECTION_ITEM_MAX, step: 1 }
          )
        )
      );
    }

    container.appendChild(fieldset);
  }
}

const FONT_SIZE_MIN_PX = 10;
const FONT_SIZE_MAX_PX = 32;

function renderThemePanel(container: HTMLElement, deps: SettingsDeps): void {
  container.appendChild(
    row(
      'Font family',
      selectInput(
        resolveFontFamilyValue(deps.options.theme.fontFamily),
        FONT_FAMILY_OPTIONS,
        (v) => {
          markThemeCustom(deps);
          deps.options.theme.fontFamily = v;
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
        markThemeCustom(deps);
        deps.options.theme.fontWeight = v;
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
        markThemeCustom(deps);
        deps.options.theme.colors.background = v;
        deps.saveOptions();
      })
    )
  );
  container.appendChild(
    row(
      'Auto text color from background',
      checkbox(deps.options.theme.autoTextColor, (v) => {
        markThemeCustom(deps);
        deps.options.theme.autoTextColor = v;
        deps.saveOptionsNow();
        deps.refreshPanel();
      })
    )
  );
  if (hasBackgroundImage(deps.options.background)) {
    const autoHelp = document.createElement('p');
    autoHelp.className = 'options-help';
    autoHelp.textContent =
      'Auto text color only applies when no background image is set. With an image, use Text color below.';
    container.appendChild(autoHelp);
  }
  const autoTextActive =
    deps.options.theme.autoTextColor && !hasBackgroundImage(deps.options.background);
  const textColorControl = colorInput(deps.options.theme.colors.text, (v) => {
    markThemeCustom(deps);
    deps.options.theme.colors.text = v;
    deps.saveOptions();
  });
  if (autoTextActive) {
    textColorControl.disabled = true;
    textColorControl.title = 'Disabled while auto text color is on and no background image is set';
  }
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
        markThemeCustom(deps);
        deps.options.theme.colors.highlight = v;
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
        markThemeCustom(deps);
        deps.options.theme.colors.shadow = v;
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

function renderBackgroundPanel(container: HTMLElement, deps: SettingsDeps): void {
  const urlError = document.createElement('p');
  urlError.className = 'options-field-error';
  urlError.setAttribute('role', 'alert');

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
    deps.options.background.imageUrl = v;
    deps.saveOptions();
    if (deps.options.theme.autoTextColor) deps.refreshPanel();
  });

  container.appendChild(row('Image URL', urlInput));
  container.appendChild(urlError);
  if (hasBackgroundImage(deps.options.background)) {
    container.appendChild(
      rangeRow(
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
      )
    );
    const opacityHelp = document.createElement('p');
    opacityHelp.className = 'options-help';
    opacityHelp.textContent =
      'Lower opacity fades the image toward your background color so bookmarks stay readable.';
    container.appendChild(opacityHelp);
  }
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

function isTopBarOrderItemEnabled(deps: SettingsDeps, itemId: TopBarItemId): boolean {
  if (itemId === 'search') return deps.options.topBar.searchEnabled;
  return isBuiltinWidgetEnabled(deps.layout, itemId);
}

function appendTopBarOrderItem(
  list: HTMLElement,
  itemId: TopBarItemId,
  deps: SettingsDeps,
  disabled: boolean
): void {
  const item = document.createElement('div');
  item.className = disabled
    ? 'options-topbar-order__item options-topbar-order__item--disabled'
    : 'options-topbar-order__item';

  const label = document.createElement('span');
  label.textContent = TOP_BAR_ITEM_LABELS[itemId];
  item.appendChild(label);

  const actions = document.createElement('div');
  actions.className = 'options-topbar-order__actions';

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.textContent = '↑';
  upBtn.title = 'Move left';
  upBtn.addEventListener('click', () => {
    deps.options.topBar.itemOrder = moveTopBarItem(deps.options.topBar.itemOrder, itemId, -1);
    deps.saveOptionsNow();
    deps.rerenderPage();
    deps.refreshPanel();
  });

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.textContent = '↓';
  downBtn.title = 'Move right';
  downBtn.addEventListener('click', () => {
    deps.options.topBar.itemOrder = moveTopBarItem(deps.options.topBar.itemOrder, itemId, 1);
    deps.saveOptionsNow();
    deps.rerenderPage();
    deps.refreshPanel();
  });

  actions.append(upBtn, downBtn);
  item.appendChild(actions);
  list.appendChild(item);
}

function renderTopBarPanel(container: HTMLElement, deps: SettingsDeps): void {
  const help = document.createElement('p');
  help.className = 'options-help';
  help.textContent = 'Reorder search and widgets left to right.';
  container.appendChild(help);

  const order = normalizeTopBarItemOrder(deps.options.topBar.itemOrder);
  const enabledItems = order.filter((itemId) => isTopBarOrderItemEnabled(deps, itemId));
  const disabledItems = order.filter((itemId) => !isTopBarOrderItemEnabled(deps, itemId));

  const list = document.createElement('div');
  list.className = 'options-topbar-order';

  for (const itemId of enabledItems) {
    appendTopBarOrderItem(list, itemId, deps, false);
  }

  if (disabledItems.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'options-topbar-order__divider';
    divider.textContent = 'Disabled';
    list.appendChild(divider);

    for (const itemId of disabledItems) {
      appendTopBarOrderItem(list, itemId, deps, true);
    }
  }

  container.appendChild(list);

  container.appendChild(
    row(
      'Full page width',
      checkbox(deps.options.topBar.fullWidth, (v) => {
        deps.options.topBar.fullWidth = v;
        deps.saveOptions();
        deps.refreshPanel();
      })
    )
  );

  if (!deps.options.topBar.fullWidth) {
    container.appendChild(
      rangeRow(
        'Top bar max width',
        deps.options.topBar.maxWidthPx,
        (v) => {
          deps.options.topBar.maxWidthPx = v;
          deps.saveOptions();
        },
        400,
        3840,
        20,
        'px'
      )
    );
  }

  if (deps.options.topBar.searchEnabled) {
    container.appendChild(
      rangeRow(
        'Search bar max width',
        clampSearchMaxWidthPx(deps.options.topBar.searchMaxWidthPx),
        (v) => {
          deps.options.topBar.searchMaxWidthPx = clampSearchMaxWidthPx(v);
          deps.saveOptions();
        },
        200,
        SEARCH_MAX_WIDTH_PX,
        10,
        'px'
      )
    );
  }

  container.appendChild(
    rangeRow(
      'Widget height',
      deps.options.topBar.widgetHeightPx,
      (v) => {
        deps.options.topBar.widgetHeightPx = v;
        deps.saveOptions();
      },
      24,
      200,
      2,
      'px'
    )
  );
  container.appendChild(
    rangeRow(
      'Widget text size',
      deps.options.topBar.widgetScale,
      (v) => {
        deps.options.topBar.widgetScale = v;
        deps.saveOptions();
      },
      0.5,
      3,
      0.05
    )
  );
  container.appendChild(
    rangeRow(
      'Gap between items',
      deps.options.topBar.gapPx,
      (v) => {
        deps.options.topBar.gapPx = v;
        deps.saveOptions();
      },
      0,
      120,
      2,
      'px'
    )
  );
}

function renderSearchBarSettings(container: HTMLElement, deps: SettingsDeps): void {
  const fieldset = document.createElement('div');
  fieldset.className = 'options-fieldset';

  fieldset.appendChild(fieldsetTitle(TOP_BAR_ITEM_LABELS.search));

  fieldset.appendChild(
    row(
      'Enabled',
      checkbox(deps.options.topBar.searchEnabled, (enabled) => {
        deps.options.topBar.searchEnabled = enabled;
        deps.saveOptionsNow();
        deps.rerenderPage();
        deps.refreshPanel();
      })
    )
  );

  fieldset.appendChild(
    row(
      'Search engine',
      selectInput(
        deps.options.topBar.searchEngine,
        SEARCH_ENGINES.map((engine) => ({
          value: engine,
          label: SEARCH_ENGINE_LABELS[engine],
        })),
        (engine) => {
          deps.options.topBar.searchEngine = engine as (typeof SEARCH_ENGINES)[number];
          deps.saveOptionsNow();
        }
      )
    )
  );

  container.appendChild(fieldset);
}

function renderWidgetsPanel(container: HTMLElement, deps: SettingsDeps): void {
  const help = document.createElement('p');
  help.className = 'options-help';
  help.textContent = 'Configure each widget below. Changes apply when the widget is enabled on the page.';
  container.appendChild(help);

  renderSearchBarSettings(container, deps);

  for (const widgetId of BUILTIN_TOP_BAR_WIDGETS) {
    const def = widgetRegistry.get(widgetId);
    const label = def?.displayName ?? widgetId;
    const fieldset = document.createElement('div');
    fieldset.className = 'options-fieldset';

    fieldset.appendChild(fieldsetTitle(label));

    fieldset.appendChild(
      row(
        'Enabled',
        checkbox(isBuiltinWidgetEnabled(deps.layout, widgetId), (enabled) => {
          setBuiltinWidgetEnabled(deps.layout, widgetId, enabled);
          deps.saveLayoutNow();
          deps.rerenderPage();
          deps.refreshPanel();
        })
      )
    );

    const meta = findWidgetColumn(deps.layout, widgetId);
    if (meta && def && isBuiltinWidgetEnabled(deps.layout, widgetId) && def.settingsSchema.length > 0) {
      appendWidgetSettingsForm(
        fieldset,
        def.settingsSchema,
        { ...def.defaultSettings, ...meta.settings },
        (partial) => {
          deps.saveWidgetSettings(widgetId, partial);
        }
      );
    }

    container.appendChild(fieldset);
  }
}

type SettingsBackupPayload = {
  layout: LayoutState;
  options: OptionsState;
  optionsLocal: OptionsLocalState;
};

function parseSettingsBackupJson(
  json: string
): { ok: true; backup: SettingsBackupPayload } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Backup must be a JSON object.' };
  }

  const root = parsed as Record<string, unknown>;
  const { layout: rawLayout, options: rawOptions, optionsLocal: rawOptionsLocal } = root;

  if (!rawLayout || typeof rawLayout !== 'object' || Array.isArray(rawLayout)) {
    return { ok: false, error: 'Backup is missing a valid layout section.' };
  }
  if (!rawOptions || typeof rawOptions !== 'object' || Array.isArray(rawOptions)) {
    return { ok: false, error: 'Backup is missing a valid options section.' };
  }
  if (!rawOptionsLocal || typeof rawOptionsLocal !== 'object' || Array.isArray(rawOptionsLocal)) {
    return { ok: false, error: 'Backup is missing a valid optionsLocal section.' };
  }

  const layoutPartial = rawLayout as Partial<LayoutState>;
  if (typeof layoutPartial.schemaVersion !== 'number' || !Array.isArray(layoutPartial.columns)) {
    return { ok: false, error: 'Backup layout must include schemaVersion and columns.' };
  }

  try {
    const optionsLocalPartial = rawOptionsLocal as Partial<OptionsLocalState>;
    return {
      ok: true,
      backup: {
        layout: sanitizeLayoutState(rawLayout),
        options: mergeOptionsState(rawOptions as Partial<OptionsState>),
        optionsLocal: {
          schemaVersion: optionsLocalPartial.schemaVersion ?? SCHEMA_VERSION,
          customCss:
            typeof optionsLocalPartial.customCss === 'string' ? optionsLocalPartial.customCss : '',
        },
      },
    };
  } catch (err) {
    return { ok: false, error: `Invalid backup: ${(err as Error).message}` };
  }
}

function applySettingsBackupFromJson(deps: SettingsDeps, json: string): boolean {
  const parsed = parseSettingsBackupJson(json);
  if (!parsed.ok) {
    window.alert(parsed.error);
    return false;
  }

  const ok = window.confirm(
    'Import this backup? Your current layout and settings will be replaced.'
  );
  if (!ok) return false;

  deps.setLayoutDirect(parsed.backup.layout);
  deps.setOptionsDirect(parsed.backup.options);
  deps.setOptionsLocalDirect(parsed.backup.optionsLocal);
  deps.rerenderPage();
  deps.refreshPanel();
  return true;
}

function downloadSettingsBackup(deps: SettingsDeps, textarea: HTMLTextAreaElement): void {
  const json = exportSettingsJson(deps);
  textarea.value = json;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'new-tab-plus-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}

function renderImportExportPanel(container: HTMLElement, deps: SettingsDeps): void {
  const help = document.createElement('p');
  help.className = 'options-help';
  help.textContent =
    'Export your layout and settings as JSON. Download a backup file or import one to restore.';

  const jsonWrap = document.createElement('div');
  jsonWrap.className = 'options-json-wrap';

  const textarea = document.createElement('textarea');
  textarea.className = 'options-json';
  textarea.value = exportSettingsJson(deps);
  textarea.setAttribute('aria-label', 'Settings backup JSON');
  textarea.spellcheck = false;
  textarea.readOnly = true;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'options-json-copy';
  copyBtn.setAttribute('aria-label', 'Copy JSON');
  const copyIconSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const copiedIconSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  copyBtn.innerHTML = copyIconSvg;

  let copyResetTimer: number | undefined;

  const showCopyAck = (): void => {
    window.clearTimeout(copyResetTimer);
    copyBtn.classList.add('is-copied');
    copyBtn.setAttribute('aria-label', 'Copied to clipboard');
    copyBtn.innerHTML = copiedIconSvg;
    copyResetTimer = window.setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      copyBtn.setAttribute('aria-label', 'Copy JSON');
      copyBtn.innerHTML = copyIconSvg;
    }, 2000);
  };

  copyBtn.addEventListener('click', () => {
    const json = exportSettingsJson(deps);
    textarea.value = json;
    void navigator.clipboard
      .writeText(json)
      .then(showCopyAck)
      .catch(() => {
        textarea.select();
        document.execCommand('copy');
        showCopyAck();
      });
  });

  jsonWrap.append(textarea, copyBtn);

  const actions = document.createElement('div');
  actions.className = 'options-actions';

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.textContent = 'Download backup';
  downloadBtn.addEventListener('click', () => downloadSettingsBackup(deps, textarea));

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.textContent = 'Import backup';
  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        if (applySettingsBackupFromJson(deps, text)) {
          textarea.value = text;
        }
      })
      .finally(() => {
        fileInput.value = '';
      });
  });

  actions.append(downloadBtn, importBtn);
  container.append(help, jsonWrap, fileInput, actions);
}

function renderAdvancedPanel(container: HTMLElement, deps: SettingsDeps): void {
  container.appendChild(
    collapsibleSection('advanced-import', 'Import / export', (body) => {
      renderImportExportPanel(body, deps);
    })
  );
  container.appendChild(
    collapsibleSection('advanced-css', 'Custom CSS', (body) => {
      const textarea = document.createElement('textarea');
      textarea.className = 'options-json';
      textarea.value = deps.optionsLocal.customCss;
      textarea.placeholder = '.column { /* your custom styles */ }';
      textarea.spellcheck = false;

      const error = document.createElement('p');
      error.className = 'options-field-error';
      error.setAttribute('role', 'alert');

      let validateTimer: number | undefined;

      const showValidationError = (message: string): void => {
        error.textContent = message;
        error.classList.add('is-visible');
        textarea.classList.add('options-json--invalid');
        textarea.setAttribute('aria-invalid', 'true');
      };

      const clearValidationError = (): void => {
        error.classList.remove('is-visible');
        error.textContent = '';
        textarea.classList.remove('options-json--invalid');
        textarea.removeAttribute('aria-invalid');
      };

      const applyValidCss = (): void => {
        const validation = validateCustomCss(textarea.value);
        if (!validation.ok) {
          showValidationError(validation.message);
          return;
        }

        clearValidationError();
        deps.optionsLocal.customCss = textarea.value;
        deps.saveOptionsLocal();
      };

      const syncCustomCss = (): void => {
        const braceError = checkBalancedBraces(textarea.value);
        if (braceError) {
          showValidationError(braceError);
          return;
        }

        window.clearTimeout(validateTimer);
        validateTimer = window.setTimeout(applyValidCss, 400);
      };

      textarea.addEventListener('input', syncCustomCss);
      textarea.addEventListener('blur', () => {
        window.clearTimeout(validateTimer);
        applyValidCss();
      });
      applyValidCss();
      body.append(textarea, error);
    })
  );
}
