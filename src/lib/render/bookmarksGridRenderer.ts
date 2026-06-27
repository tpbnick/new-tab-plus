import type { WidgetInstance } from '../../widgets/contract';
import type { BookmarkColumnViewModel, BookmarkNodeViewModel } from '../types';
import type { BookmarkGridColumnMeta, WidgetColumnMeta } from '../storage/schema';
import type { SpecialSectionViewModel } from '../sections';
import { fnv1aHash } from '../ui/fnv1aHash';
import {
  renderBookmarkColumn,
  type BookmarkColumnRenderOptions,
} from './bookmarkColumnRenderer';
import { renderWidgetColumn, type WidgetColumnCallbacks } from './widgetColumnRenderer';

type GridColumnMeta = BookmarkGridColumnMeta | WidgetColumnMeta;

const RENDER_SIG_ATTR = 'data-render-sig';
const WIDGET_SETTINGS_SIG_ATTR = 'data-widget-settings-sig';

export interface GridWidgetSlot {
  instanceId: string;
  element: HTMLElement;
  instance: WidgetInstance;
}

export interface RefreshBookmarksGridParams {
  bookmarksGrid: HTMLElement;
  gridColumnMeta: GridColumnMeta[];
  bookmarkColumnsById: Map<string, BookmarkColumnViewModel>;
  linkOptions: BookmarkColumnRenderOptions;
  widgetCallbacks: WidgetColumnCallbacks;
  widgetSlots: Map<string, GridWidgetSlot>;
  renderEmpty: () => HTMLElement;
}

export interface RefreshBookmarksGridResult {
  widgetSlots: Map<string, GridWidgetSlot>;
  gridDomChanged: boolean;
}

function appendNodeSig(parts: string[], node: BookmarkNodeViewModel): void {
  parts.push(`n:${node.id}:${node.title}:${node.url ?? ''}:${node.collapsed ? 1 : 0}`);
  if (node.children) {
    for (const child of node.children) appendNodeSig(parts, child);
  }
}

function appendSectionSig(parts: string[], vm: SpecialSectionViewModel): void {
  for (const group of vm.groups) {
    parts.push(`g:${group.title}`);
    for (const item of group.items) {
      parts.push(`i:${item.title}:${item.url}:${item.sessionId ?? ''}`);
    }
  }
}

export function bookmarkColumnSignature(
  vm: BookmarkColumnViewModel,
  linkOptions: BookmarkColumnRenderOptions
): string {
  const parts: string[] = [
    `o:${linkOptions.openLinksInSameTab ? 1 : 0}`,
    `r:${linkOptions.rememberOpenFolders ? 1 : 0}`,
    `l:${linkOptions.lockColumns ? 1 : 0}`,
  ];

  for (const entry of vm.stack) {
    if (entry.kind === 'folder') {
      parts.push(`f:${entry.folder.bookmarkId}:${entry.folder.title}:${entry.folder.collapsed ? 1 : 0}`);
      for (const child of entry.folder.children) appendNodeSig(parts, child);
      continue;
    }
    const collapsed = linkOptions.folderState?.[entry.sectionId]?.collapsed ? 1 : 0;
    parts.push(`s:${entry.sectionId}:${collapsed}`);
    const sectionVm = linkOptions.sectionsById?.get(entry.sectionId);
    if (sectionVm) appendSectionSig(parts, sectionVm);
  }

  return fnv1aHash(parts.join('\n'));
}

export function widgetSettingsSignature(meta: WidgetColumnMeta): string {
  return fnv1aHash(JSON.stringify(meta.settings ?? {}));
}

function indexExistingColumns(grid: HTMLElement): Map<string, HTMLElement> {
  const byId = new Map<string, HTMLElement>();
  for (const col of grid.querySelectorAll<HTMLElement>('.column[data-column-id]')) {
    const id = col.dataset.columnId;
    if (id) byId.set(id, col);
  }
  return byId;
}

function destroyRemovedWidgets(
  previous: Map<string, GridWidgetSlot>,
  next: Map<string, GridWidgetSlot>
): void {
  for (const [instanceId, slot] of previous) {
    if (!next.has(instanceId)) slot.instance.destroy();
  }
}

const COLUMNS_LOCKED_ATTR = 'data-columns-locked';

export function refreshBookmarksGrid(params: RefreshBookmarksGridParams): RefreshBookmarksGridResult {
  const {
    bookmarksGrid,
    gridColumnMeta,
    bookmarkColumnsById,
    linkOptions,
    widgetCallbacks,
    widgetSlots,
    renderEmpty,
  } = params;

  const existingColumns = indexExistingColumns(bookmarksGrid);
  const nextWidgetSlots = new Map<string, GridWidgetSlot>();
  const reusedElements = new Set<HTMLElement>();
  const fragment = document.createDocumentFragment();
  let gridHasContent = false;
  let gridDomChanged = false;

  const columnsLocked = linkOptions.lockColumns ? '1' : '0';

  for (const meta of gridColumnMeta) {
    if (meta.type === 'bookmarkGrid') {
      const vm = bookmarkColumnsById.get(meta.id);
      if (!vm || vm.stack.length === 0) continue;

      const signature = bookmarkColumnSignature(vm, linkOptions);
      const existing = existingColumns.get(meta.id);
      if (existing?.getAttribute(RENDER_SIG_ATTR) === signature) {
        fragment.appendChild(existing);
        reusedElements.add(existing);
      } else {
        const column = renderBookmarkColumn(vm, linkOptions);
        column.setAttribute(RENDER_SIG_ATTR, signature);
        fragment.appendChild(column);
        gridDomChanged = true;
      }
      gridHasContent = true;
      continue;
    }

    const settingsSig = widgetSettingsSignature(meta);
    const existingWidget = widgetSlots.get(meta.instanceId);
    if (existingWidget) {
      const settingsChanged =
        existingWidget.element.getAttribute(WIDGET_SETTINGS_SIG_ATTR) !== settingsSig;
      const lockChanged = existingWidget.element.getAttribute(COLUMNS_LOCKED_ATTR) !== columnsLocked;
      if (settingsChanged || lockChanged) {
        existingWidget.instance.destroy();
        gridDomChanged = true;
      } else {
        fragment.appendChild(existingWidget.element);
        reusedElements.add(existingWidget.element);
        nextWidgetSlots.set(meta.instanceId, existingWidget);
        gridHasContent = true;
        continue;
      }
    }

    const { element, instance } = renderWidgetColumn(meta, widgetCallbacks, {
      lockColumns: linkOptions.lockColumns,
    });
    element.setAttribute(WIDGET_SETTINGS_SIG_ATTR, settingsSig);
    element.setAttribute(COLUMNS_LOCKED_ATTR, columnsLocked);
    fragment.appendChild(element);
    if (instance) {
      nextWidgetSlots.set(meta.instanceId, {
        instanceId: meta.instanceId,
        element,
        instance,
      });
    }
    gridDomChanged = true;
    gridHasContent = true;
  }

  for (const [instanceId] of widgetSlots) {
    if (!nextWidgetSlots.has(instanceId)) gridDomChanged = true;
  }

  for (const col of existingColumns.values()) {
    if (!reusedElements.has(col)) gridDomChanged = true;
  }

  destroyRemovedWidgets(widgetSlots, nextWidgetSlots);

  bookmarksGrid.replaceChildren(fragment);
  if (!gridHasContent) {
    bookmarksGrid.appendChild(renderEmpty());
    gridDomChanged = true;
  }

  return { widgetSlots: nextWidgetSlots, gridDomChanged };
}
