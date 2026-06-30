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
import type { TopBarItemId } from '../storage/schema';
import {
  createCheckboxInput as checkbox,
  createOptionsRow as row,
  createRangeRow as rangeRow,
  createSelectInput as selectInput,
} from '../ui/formControls';
import { collapsibleSection, fieldsetTitle } from './collapsibleSection';
import type { SettingsDeps } from './deps';

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
        },
        'options-select--wide'
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

export function renderTopBarSettingsPanel(container: HTMLElement, deps: SettingsDeps): void {
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
