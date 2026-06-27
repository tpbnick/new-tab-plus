import type { SpecialSectionViewModel } from '../sections';
import type { SectionItem } from '../sections/mostVisited';
import { renderBookmarkLinkItem } from './bookmarkLink';
import { renderCollapsibleStackBlock } from './collapsibleStackBlock';

export interface SpecialSectionRenderOptions {
  openLinksInSameTab: boolean;
  collapsed?: boolean;
  lockColumns?: boolean;
}

/** Renders a special section as a stack block inside a bookmark grid column. */
export function renderSpecialSectionBlock(
  vm: SpecialSectionViewModel,
  options: SpecialSectionRenderOptions
): HTMLElement {
  const collapsed = options.collapsed ?? false;
  const body = document.createElement('div');

  for (const group of vm.groups) {
    if (group.title) {
      const groupHeading = document.createElement('div');
      groupHeading.className = 'section-group__title';
      groupHeading.textContent = group.title;
      body.appendChild(groupHeading);
    }

    const list = document.createElement('ul');
    list.className = 'bookmark-list';
    for (const item of group.items) {
      list.appendChild(renderSectionItem(item, options));
    }
    body.appendChild(list);
  }

  return renderCollapsibleStackBlock(
    {
      id: vm.id,
      title: vm.title,
      collapsed,
      headerTitle: options.lockColumns
        ? 'Click to expand or collapse'
        : 'Click to expand or collapse · drag to move this section',
    },
    body
  );
}

function renderSectionItem(item: SectionItem, options: SpecialSectionRenderOptions): HTMLElement {
  return renderBookmarkLinkItem(
    { title: item.title, url: item.url, sessionId: item.sessionId },
    { openLinksInSameTab: options.openLinksInSameTab }
  );
}
