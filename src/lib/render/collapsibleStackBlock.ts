import { collapsibleLabel } from '../ui/collapsible';

export interface CollapsibleStackBlockOptions {
  id: string;
  title: string;
  collapsed: boolean;
  headerTitle: string;
}

/** Folder-column block shell shared by bookmark folders and special sections. */
export function renderCollapsibleStackBlock(
  options: CollapsibleStackBlockOptions,
  bodyContent: HTMLElement
): HTMLElement {
  const block = document.createElement('div');
  block.className = 'folder-column-block';
  block.dataset.folderId = options.id;
  if (options.collapsed) {
    block.classList.add('is-collapsed');
    block.dataset.collapsed = 'true';
  }

  const heading = document.createElement('button');
  heading.type = 'button';
  heading.className = 'folder-column-header';
  heading.title = options.headerTitle;
  heading.dataset.folderId = options.id;
  heading.setAttribute('aria-expanded', String(!options.collapsed));
  heading.appendChild(collapsibleLabel(options.title, options.collapsed));
  block.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'folder-column-body';
  body.appendChild(bodyContent);
  block.appendChild(body);
  return block;
}
