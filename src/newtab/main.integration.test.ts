import { beforeEach, describe, expect, it, vi } from 'vitest';
import { optionsOnlyGridInteractionsChanged } from '../lib/storage/storage';
import {
  createDefaultLayoutState,
  createDefaultOptionsState,
  type OptionsState,
} from '../lib/storage/schema';
import { resolveStackKeyboardMove } from '../lib/dnd/keyboardStackMove';
import { reorderIds } from '../lib/dnd/reorder';
import { getColumnStack, setColumnStack } from '../lib/grid/gridStack';
import type { BookmarkGridColumnMeta, LayoutState } from '../lib/storage/schema';

/** Exercises main.ts wiring patterns without bootstrapping the full new tab page. */
describe('main.ts wiring integration', () => {
  it('detects lockColumns-only option changes for grid rebind', () => {
    const previous = createDefaultOptionsState();
    const next: OptionsState = {
      ...createDefaultOptionsState(),
      general: { ...createDefaultOptionsState().general, lockColumns: true },
    };
    expect(optionsOnlyGridInteractionsChanged(previous, next)).toBe(true);
  });

  it('applies keyboard stack reorder the same way main.ts handleStackKeyboardMove would', () => {
    let layout: LayoutState = createDefaultLayoutState();
    layout.columns = [
      {
        id: 'grid:ab',
        type: 'bookmarkGrid',
        order: 0,
        enabled: true,
        stack: ['a', 'b'],
      },
      {
        id: 'grid:c',
        type: 'bookmarkGrid',
        order: 1,
        enabled: true,
        stack: ['c'],
      },
    ];

    const gridCols = layout.columns.filter(
      (c): c is BookmarkGridColumnMeta => c.type === 'bookmarkGrid'
    );
    const action = resolveStackKeyboardMove(gridCols, 'b', 'grid:ab', 'up');
    expect(action.type).toBe('reorder-in-column');

    if (action.type === 'reorder-in-column') {
      const col = layout.columns.find(
        (c): c is BookmarkGridColumnMeta =>
          c.type === 'bookmarkGrid' && c.id === action.gridColumnId
      )!;
      setColumnStack(col, reorderIds(getColumnStack(col), action.folderId, action.beforeFolderId));
    }

    expect(getColumnStack(layout.columns[0] as BookmarkGridColumnMeta)).toEqual(['b', 'a']);
  });

  it('queues folder collapse saves without losing later updates', async () => {
    const saved: Array<Record<string, { collapsed: boolean }>> = [];
    let chain = Promise.resolve();

    const persistLike = (folderId: string, collapsed: boolean) => {
      chain = chain
        .then(async () => {
          await new Promise((r) => setTimeout(r, 5));
          saved.push({ [folderId]: { collapsed } });
        })
        .catch(() => {});
    };

    persistLike('a', true);
    persistLike('b', false);
    await chain;

    expect(saved).toEqual([{ a: { collapsed: true } }, { b: { collapsed: false } }]);
  });

  it('debounces widget settings saves like main.ts persistPendingWidgetSettings', async () => {
    vi.useFakeTimers();
    const pending = new Set<string>();
    let persistCount = 0;

    const schedule = (widgetId: string) => {
      pending.add(widgetId);
      window.clearTimeout((schedule as { timer?: number }).timer);
      (schedule as { timer?: number }).timer = window.setTimeout(async () => {
        const ids = [...pending];
        pending.clear();
        if (ids.length === 0) return;
        persistCount += 1;
      }, 250);
    };

    schedule('weather');
    schedule('weather');
    schedule('clock');
    await vi.advanceTimersByTimeAsync(250);

    expect(persistCount).toBe(1);
    vi.useRealTimers();
  });
});

describe('main.ts bootstrap guards', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('requires #app for save error banners used by main.ts', async () => {
    const { showSaveError } = await import('../lib/ui/saveErrorBanner');
    showSaveError('Could not save layout.');
    expect(document.querySelector('.ntp-save-error-banner')).toBeTruthy();
  });
});
