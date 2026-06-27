import type { BookmarkColumnViewModel, BookmarkFolderViewModel, BookmarkNodeViewModel } from '../types';
import type { SpecialSectionViewModel } from '../sections';
import type { FolderUiState } from '../storage/schema';
import { collapsibleLabel } from '../ui/collapsible';
import { renderBookmarkLinkItem } from './bookmarkLink';
import { renderCollapsibleStackBlock } from './collapsibleStackBlock';
import { renderSpecialSectionBlock } from './specialSectionRenderer';

export interface BookmarkColumnRenderOptions {
  openLinksInSameTab: boolean;
  rememberOpenFolders?: boolean;
  lockColumns?: boolean;
  sectionsById?: Map<string, SpecialSectionViewModel>;
  folderState?: Record<string, FolderUiState>;
}

function stackHeaderTitle(lockColumns: boolean | undefined, dragHint: string): string {
  if (lockColumns) return 'Click to expand or collapse';
  return `Click to expand or collapse · ${dragHint}`;
}

export function renderBookmarkColumn(
  vm: BookmarkColumnViewModel,
  options: BookmarkColumnRenderOptions
): HTMLElement {
  const column = document.createElement('section');
  column.className = 'column column--bookmark-grid';
  column.dataset.dragKind = 'column';
  column.dataset.columnId = vm.id;
  column.dataset.gridColumnId = vm.id;

  for (const entry of vm.stack) {
    if (entry.kind === 'folder') {
      column.appendChild(renderFolderBlock(entry.folder, options));
      continue;
    }
    const sectionVm = options.sectionsById?.get(entry.sectionId);
    if (sectionVm) {
      const collapsed = options.folderState?.[entry.sectionId]?.collapsed ?? false;
      column.appendChild(renderSpecialSectionBlock(sectionVm, { ...options, collapsed }));
    }
  }

  return column;
}

function renderFolderBlock(
  folder: BookmarkFolderViewModel,
  options: BookmarkColumnRenderOptions
): HTMLElement {
  const body = document.createElement('div');
  body.appendChild(renderNodeList(folder.children ?? [], options));

  return renderCollapsibleStackBlock(
    {
      id: folder.bookmarkId,
      title: folder.title,
      collapsed: folder.collapsed,
      headerTitle: stackHeaderTitle(options.lockColumns, 'drag to move'),
    },
    body
  );
}

function renderNodeList(
  nodes: BookmarkNodeViewModel[] | undefined,
  options: BookmarkColumnRenderOptions
): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'bookmark-list';
  for (const node of nodes ?? []) {
    list.appendChild(renderNode(node, options));
  }
  return list;
}

function renderNode(
  node: BookmarkNodeViewModel,
  options: BookmarkColumnRenderOptions
): HTMLElement {
  const item = document.createElement('li');
  item.className = 'bookmark-item';
  item.dataset.bookmarkId = node.id;

  if (node.children) {
    item.classList.add('bookmark-item--folder');

    if (options.rememberOpenFolders === false) {
      const label = document.createElement('span');
      label.className = 'folder-toggle folder-toggle--static';
      label.appendChild(collapsibleLabel(node.title, false));
      item.appendChild(label);

      const body = document.createElement('div');
      body.className = 'folder-item-body';
      body.appendChild(renderNodeList(node.children, options));
      item.appendChild(body);
    } else {
      item.classList.add('is-collapsible');
      if (node.collapsed) {
        item.classList.add('is-collapsed');
        item.dataset.collapsed = 'true';
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'folder-toggle';
      button.title = 'Click to expand or collapse';
      button.setAttribute('aria-expanded', String(!node.collapsed));
      button.appendChild(collapsibleLabel(node.title, node.collapsed));
      item.appendChild(button);

      const body = document.createElement('div');
      body.className = 'folder-item-body';
      body.appendChild(renderNodeList(node.children, options));
      item.appendChild(body);
    }
  } else {
    const linkItem = renderBookmarkLinkItem(
      { title: node.title, url: node.url },
      { openLinksInSameTab: options.openLinksInSameTab }
    );
    linkItem.dataset.bookmarkId = node.id;
    return linkItem;
  }

  return item;
}
