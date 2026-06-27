import { consumeHeaderClickSuppression } from '../dnd/pointerBookmarkDrag';
import type { StackMoveDirection } from '../dnd/keyboardStackMove';

export interface CollapsibleAttachOptions {
  expandOnHover: boolean;
  onCollapsedChange(id: string, collapsed: boolean): void;
  columnsLocked?: boolean;
  onStackKeyboardMove?: (
    id: string,
    sourceGridColumnId: string,
    direction: StackMoveDirection
  ) => void;
}

const CLASS_COLLAPSED = 'is-collapsed';
const CLASS_HOVER_EXPANDED = 'is-hover-expanded';

const NON_SELECTABLE_SELECTOR =
  '.folder-column-header, .folder-toggle, .folder-toggle--static, .column__title, .widget-inline, .widget-body';

function preventLabelTextSelection(root: HTMLElement): () => void {
  const onMouseDown = (e: MouseEvent) => {
    const control = (e.target as HTMLElement).closest<HTMLElement>(NON_SELECTABLE_SELECTOR);
    if (!control || !root.contains(control)) return;
    if (e.detail > 1) e.preventDefault();
  };

  const onSelectStart = (e: Event) => {
    const control = (e.target as HTMLElement).closest<HTMLElement>(NON_SELECTABLE_SELECTOR);
    if (!control || !root.contains(control)) return;
    e.preventDefault();
  };

  root.addEventListener('mousedown', onMouseDown);
  root.addEventListener('selectstart', onSelectStart);
  return () => {
    root.removeEventListener('mousedown', onMouseDown);
    root.removeEventListener('selectstart', onSelectStart);
  };
}

function chevron(collapsed: boolean): string {
  return collapsed ? '▸' : '▾';
}

function updateChevron(control: HTMLElement, collapsed: boolean): void {
  const chev = control.querySelector<HTMLElement>('.folder-chevron');
  if (chev) chev.textContent = chevron(collapsed);
}

function setCollapsed(container: HTMLElement, collapsed: boolean): void {
  container.classList.toggle(CLASS_COLLAPSED, collapsed);
  container.dataset.collapsed = collapsed ? 'true' : 'false';
  const control = container.querySelector<HTMLElement>('.folder-column-header, .folder-toggle');
  if (control) {
    control.setAttribute('aria-expanded', String(!collapsed));
    updateChevron(control, collapsed);
  }
}

function attachHoverPeek(container: HTMLElement, options: CollapsibleAttachOptions): () => void {
  if (!options.expandOnHover) return () => {};

  const onEnter = () => {
    if (container.classList.contains(CLASS_COLLAPSED)) {
      container.classList.add(CLASS_HOVER_EXPANDED);
    }
  };
  const onLeave = () => {
    container.classList.remove(CLASS_HOVER_EXPANDED);
  };

  container.addEventListener('mouseenter', onEnter);
  container.addEventListener('mouseleave', onLeave);
  return () => {
    container.removeEventListener('mouseenter', onEnter);
    container.removeEventListener('mouseleave', onLeave);
  };
}

function attachHeaderCollapsible(
  container: HTMLElement,
  control: HTMLElement,
  id: string,
  options: CollapsibleAttachOptions,
  suppressClickAfterDrag: boolean
): () => void {
  const onClick = (e: MouseEvent) => {
    if (suppressClickAfterDrag && consumeHeaderClickSuppression()) return;

    e.preventDefault();
    e.stopPropagation();

    container.classList.remove(CLASS_HOVER_EXPANDED);
    const collapsed = !container.classList.contains(CLASS_COLLAPSED);
    setCollapsed(container, collapsed);
    options.onCollapsedChange(id, collapsed);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (options.columnsLocked || !options.onStackKeyboardMove) return;
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;

    const directionMap: Partial<Record<string, StackMoveDirection>> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const direction = directionMap[e.key];
    if (!direction) return;

    e.preventDefault();
    const gridColumn = control.closest<HTMLElement>('.column--bookmark-grid');
    const sourceGridColumnId = gridColumn?.dataset.gridColumnId;
    if (!sourceGridColumnId) return;
    options.onStackKeyboardMove(id, sourceGridColumnId, direction);
  };

  control.addEventListener('click', onClick);
  control.addEventListener('keydown', onKeyDown);
  const disposeHover = attachHoverPeek(container, options);

  return () => {
    control.removeEventListener('click', onClick);
    control.removeEventListener('keydown', onKeyDown);
    disposeHover();
  };
}

/** Blocks double-click and drag selection on folder headers, toggles, and widget labels. */
export function attachNonSelectableLabels(root: HTMLElement): () => void {
  return preventLabelTextSelection(root);
}

/** Click header/toggle to expand or collapse. */
export function attachCollapsible(root: HTMLElement, options: CollapsibleAttachOptions): () => void {
  const disposers: Array<() => void> = [];

  for (const block of root.querySelectorAll<HTMLElement>('.folder-column-block')) {
    const id = block.dataset.folderId;
    const header = block.querySelector<HTMLElement>('.folder-column-header');
    if (!id || !header) continue;
    disposers.push(attachHeaderCollapsible(block, header, id, options, true));
  }

  for (const item of root.querySelectorAll<HTMLElement>('.bookmark-item--folder.is-collapsible')) {
    const id = item.dataset.bookmarkId;
    const toggle = item.querySelector<HTMLElement>('.folder-toggle');
    if (!id || !toggle) continue;
    disposers.push(attachHeaderCollapsible(item, toggle, id, options, false));
  }

  return () => {
    for (const dispose of disposers) dispose();
  };
}

export function collapsibleLabel(title: string, collapsed: boolean): DocumentFragment {
  const frag = document.createDocumentFragment();
  const chev = document.createElement('span');
  chev.className = 'folder-chevron';
  chev.textContent = chevron(collapsed);
  chev.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'folder-header-label';
  label.textContent = title;
  frag.append(chev, document.createTextNode(' '), label);
  return frag;
}
