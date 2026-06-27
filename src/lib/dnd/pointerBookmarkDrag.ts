import {
  getFolderDropLineTarget,
  resolveGridFolderDrop,
  type GridFolderDropPosition,
  type GridFolderDropResult,
} from './bookmarkDropTarget';
import { gridFolderDropEquals } from './dropTargetEquals';
import { dndLog, dndWarn } from '../debug/dndDebug';

export const FOLDER_DRAG_THRESHOLD_PX = 5;
const DRAG_THRESHOLD_PX = FOLDER_DRAG_THRESHOLD_PX;
const CLASS_DRAGGING = 'folder-column-header--dragging';

let blockNextHeaderClick = false;

/** Suppresses the click that follows a completed header drag. */
export function consumeHeaderClickSuppression(): boolean {
  if (!blockNextHeaderClick) return false;
  blockNextHeaderClick = false;
  return true;
}

type PendingFolderDrag = {
  header: HTMLElement;
  folderId: string;
  sourceGridColumnId: string;
  startX: number;
  startY: number;
  capturedPointerId?: number;
};

export interface PointerFolderDragCallbacks {
  onGridFolderDrop(
    folderId: string,
    sourceGridColumnId: string,
    target: GridFolderDropResult
  ): void;
}

/** Pointer drag for bookmark folder and special-section stack headers. */
export function attachPointerFolderDrag(
  gridHost: HTMLElement,
  callbacks: PointerFolderDragCallbacks
): () => void {
  let pending: PendingFolderDrag | null = null;
  let dragging = false;
  let hoverFolderTarget: GridFolderDropResult | null = null;

  const dropLine = document.createElement('div');
  dropLine.className = 'bookmark-drop-line';
  dropLine.hidden = true;
  document.body.appendChild(dropLine);

  function hideDropLine() {
    dropLine.hidden = true;
  }

  function showHorizontalDropLine(block: HTMLElement, position: GridFolderDropPosition) {
    const rect = block.getBoundingClientRect();
    const y = position === 'before' ? rect.top : rect.bottom;
    dropLine.style.left = `${rect.left}px`;
    dropLine.style.top = `${y - 1}px`;
    dropLine.style.width = `${rect.width}px`;
    dropLine.style.height = '2px';
    dropLine.hidden = false;
  }

  function showVerticalDropLine(lineX: number) {
    const gridRect = gridHost.getBoundingClientRect();
    dropLine.style.left = `${lineX - 1}px`;
    dropLine.style.top = `${gridRect.top}px`;
    dropLine.style.width = '2px';
    dropLine.style.height = `${gridRect.height}px`;
    dropLine.hidden = false;
  }

  function releaseCapture(): void {
    if (pending?.header == null || pending.capturedPointerId == null) return;
    try {
      if (pending.header.hasPointerCapture(pending.capturedPointerId)) {
        pending.header.releasePointerCapture(pending.capturedPointerId);
      }
    } catch {
      /* pointer may already be released */
    }
    pending.capturedPointerId = undefined;
  }

  function cleanup() {
    releaseCapture();
    pending?.header.classList.remove(CLASS_DRAGGING);
    hideDropLine();
    document.body.classList.remove('is-folder-dragging');
    pending = null;
    dragging = false;
    hoverFolderTarget = null;
  }

  function updateFolderDropTarget(clientX: number, clientY: number, drag: PendingFolderDrag) {
    const skipBlock = drag.header.closest<HTMLElement>('.folder-column-block');
    const resolved = resolveGridFolderDrop(gridHost, drag.folderId, clientX, clientY, skipBlock);

    if (!resolved) {
      hideDropLine();
      hoverFolderTarget = null;
      return;
    }

    if (!gridFolderDropEquals(resolved, hoverFolderTarget)) {
      hoverFolderTarget = resolved;

      if (resolved.mode === 'into') {
        if (resolved.targetFolderId) {
          const block = getFolderDropLineTarget(gridHost, resolved.targetFolderId);
          if (block) showHorizontalDropLine(block, resolved.position);
        } else {
          const column = gridHost.querySelector<HTMLElement>(
            `[data-grid-column-id="${resolved.gridColumnId}"]`
          );
          if (column) {
            const rect = column.getBoundingClientRect();
            dropLine.style.left = `${rect.left}px`;
            dropLine.style.top = `${rect.bottom - 2}px`;
            dropLine.style.width = `${rect.width}px`;
            dropLine.style.height = '2px';
            dropLine.hidden = false;
          }
        }
        dndLog('pointer dragover (into column)', resolved);
      } else {
        showVerticalDropLine(resolved.lineX);
        dndLog('pointer dragover (new column)', resolved);
      }
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;

    const header = (e.target as HTMLElement).closest<HTMLElement>('.folder-column-header');
    if (!header || !gridHost.contains(header)) return;

    const folderId = header.dataset.folderId;
    const sourceGridColumnId = header.closest<HTMLElement>('.column--bookmark-grid')?.dataset
      .gridColumnId;
    if (!folderId || !sourceGridColumnId) return;

    pending = {
      header,
      folderId,
      sourceGridColumnId,
      startX: e.clientX,
      startY: e.clientY,
    };
    dndLog('pointer down on folder header', { folderId, sourceGridColumnId });
  }

  function onPointerMove(e: PointerEvent) {
    if (!pending && !dragging) return;

    if (pending && !dragging) {
      const dx = e.clientX - pending.startX;
      const dy = e.clientY - pending.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;

      dragging = true;
      document.body.classList.add('is-folder-dragging');
      pending.header.classList.add(CLASS_DRAGGING);
      pending.header.setPointerCapture(e.pointerId);
      pending.capturedPointerId = e.pointerId;
      dndLog('pointer folder drag started', {
        folderId: pending.folderId,
        sourceGridColumnId: pending.sourceGridColumnId,
      });
    }

    if (!dragging || !pending) return;

    e.preventDefault();
    updateFolderDropTarget(e.clientX, e.clientY, pending);
  }

  function onPointerUp(e: PointerEvent) {
    const hadValidDrop = !!(dragging && pending && hoverFolderTarget);

    if (dragging && pending) {
      if (hoverFolderTarget) {
        e.preventDefault();
        e.stopPropagation();
        dndLog('pointer folder drop', {
          folderId: pending.folderId,
          sourceGridColumnId: pending.sourceGridColumnId,
          target: hoverFolderTarget,
        });
        callbacks.onGridFolderDrop(pending.folderId, pending.sourceGridColumnId, hoverFolderTarget);
      } else {
        dndWarn('pointer drag ended with no valid drop target', { folderId: pending.folderId });
      }
    }

    releaseCapture();
    if (hadValidDrop) blockNextHeaderClick = true;
    cleanup();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') cleanup();
  }

  gridHost.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('keydown', onKeyDown);

  return () => {
    gridHost.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    document.removeEventListener('keydown', onKeyDown);
    cleanup();
    dropLine.remove();
  };
}
