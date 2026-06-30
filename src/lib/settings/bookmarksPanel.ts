import {
  createCheckboxInput as checkbox,
  createNumberInput as numberInput,
  createOptionsRow as row,
  createRangeRow as rangeRow,
} from '../ui/formControls';
import type { SpecialSectionMeta } from '../storage/schema';
import { SECTION_TITLES } from '../sections';
import { collapsibleSection, fieldsetTitle } from './collapsibleSection';
import type { SettingsDeps } from './deps';

const SECTION_ITEM_MIN = 1;
const SECTION_ITEM_MAX = 30;

function clampSectionItemCount(value: number): number {
  return Math.min(SECTION_ITEM_MAX, Math.max(SECTION_ITEM_MIN, Math.round(value)));
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

export function renderBookmarksPanel(container: HTMLElement, deps: SettingsDeps): void {
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
