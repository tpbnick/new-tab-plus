import type { GridWidgetSlot } from '../../lib/render/bookmarksGridRenderer';
import {
  createDefaultLayoutState,
  createDefaultOptionsLocalState,
  createDefaultOptionsState,
} from '../../lib/storage/schema';
import type { BookmarkSearchEntry } from '../../lib/search/bookmarkSearchIndex';
import type { RenderScope } from '../../lib/render/renderScope';
import type { WidgetInstance } from '../../widgets/contract';

export const appState = {
  layoutState: createDefaultLayoutState(),
  optionsState: createDefaultOptionsState(),
  optionsLocalState: createDefaultOptionsLocalState(),
  detachFolderDnd: null as (() => void) | null,
  detachCollapsible: null as (() => void) | null,
  topBarWidgetInstances: [] as WidgetInstance[],
  gridWidgetSlots: new Map<string, GridWidgetSlot>(),
  bookmarkSearchEntries: [] as BookmarkSearchEntry[],
  lastBookmarkTreeSig: '',
  renderGeneration: 0,
  renderTimer: undefined as number | undefined,
  pendingRenderScope: null as RenderScope | null,
  cachedTopBarKey: '',
  layoutUpdateChain: Promise.resolve() as Promise<void>,
  layoutDirty: false,
  lastBoundExpandOnHover: null as boolean | null,
  lastBoundLockColumns: null as boolean | null,
  searchBarElement: null as HTMLElement | null,
  saveLayoutTimer: undefined as number | undefined,
  saveOptionsTimer: undefined as number | undefined,
  saveOptionsLocalTimer: undefined as number | undefined,
  saveWidgetSettingsTimer: undefined as number | undefined,
  pendingWidgetSettingsSaves: new Set<string>(),
  focusRefreshTimer: undefined as number | undefined,
  openSettingsModal: () => {},
};

export function markLayoutDirty(): void {
  appState.layoutDirty = true;
}
