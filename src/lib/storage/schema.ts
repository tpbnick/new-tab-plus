import { clampTextOpacityPct } from '../theme/colorUtils';
import {
  clampLinkHoverDurationMs,
  clampLinkHoverGrowPct,
  normalizeLinkHoverEffect,
  type LinkHoverEffect,
} from '../theme/linkHover';
import { snapPercent } from '../ui/percentSnap';
import { normalizeSearchEngine, type SearchEngineId } from '../search/searchEngine';

export const SCHEMA_VERSION = 3;

export type SpecialSectionKind = 'mostVisited' | 'recentlyClosed' | 'apps' | 'otherDevices';

interface ColumnEntryBase {
  id: string;
  order: number;
  enabled: boolean;
}

/** A visual column in the bookmarks grid — holds folders and special sections stacked top to bottom. */
export interface BookmarkGridColumnMeta extends ColumnEntryBase {
  type: 'bookmarkGrid';
  /** Bookmark folder ids and/or special: section ids, top to bottom. */
  stack: string[];
}

export interface SpecialSectionMeta extends ColumnEntryBase {
  type: 'specialSection';
  kind: SpecialSectionKind;
  itemCount?: number;
}

export interface WidgetColumnMeta extends ColumnEntryBase {
  type: 'widget';
  widgetId: string;
  instanceId: string;
  settings: Record<string, unknown>;
}

export type ColumnEntry = BookmarkGridColumnMeta | SpecialSectionMeta | WidgetColumnMeta;

export interface FolderUiState {
  collapsed: boolean;
}

export interface LayoutState {
  schemaVersion: number;
  columns: ColumnEntry[];
  folderState: Record<string, FolderUiState>;
}

export type TopBarItemId = 'search' | 'clock' | 'weather';

export type { SearchEngineId };

/** Saved font/color choices for the Custom theme preset. */
export interface ThemeCustomSnapshot {
  fontFamily: string;
  fontWeight: number;
  colors: {
    text: string;
    background: string;
    highlight: string;
    highlightText: string;
    shadow: string;
  };
  autoTextColor: boolean;
}

export interface OptionsState {
  schemaVersion: number;
  general: {
    rememberOpenFolders: boolean;
    /** When true, bookmark and section links navigate this tab instead of opening a new one. */
    openLinksInSameTab: boolean;
    /** Peek at collapsed stack blocks and nested folders on hover. */
    expandCollapsedOnHover: boolean;
    /** Expand/collapse animation duration (ms). 0 = instant. */
    folderCollapseAnimationMs: number;
    /** When true, folder and section columns cannot be dragged or rearranged. */
    lockColumns: boolean;
  };
  topBar: {
    /** Left-to-right order of search and built-in widgets. Disabled widgets are skipped at render. */
    itemOrder: TopBarItemId[];
    /** When true, the top bar spans the full viewport width. */
    fullWidth: boolean;
    /** Show the web search bar in the top bar. */
    searchEnabled: boolean;
    /** Default search engine for the web search bar. */
    searchEngine: SearchEngineId;
    searchMaxWidthPx: number;
    widgetHeightPx: number;
    maxWidthPx: number;
    gapPx: number;
    widgetScale: number;
  };
  theme: {
    /** Active color/font preset, or "custom" when manually edited. */
    presetId: string;
    /** Last saved font/color settings for the Custom theme. */
    customSnapshot: ThemeCustomSnapshot;
    fontFamily: string;
    fontWeight: number;
    fontSizePx: number;
    colors: {
      text: string;
      background: string;
      highlight: string;
      highlightText: string;
      shadow: string;
    };
    spacing: number;
    /** Maximum width a bookmark/section/widget column can grow to (px). */
    columnWidth: number;
    uppercaseFolderNames: boolean;
    /** Page top padding (px) - distance from the top of the screen to the search bar. */
    topSpacingPx: number;
    /** Gap (px) between the top bar, the sections row, and the bookmarks grid. */
    regionGapPx: number;
    /** When true, folder and column headers use the theme highlight color. */
    useHighlightForFolderHeaders: boolean;
    /** Folder/column header color when useHighlightForFolderHeaders is false. */
    folderHeaderColor: string;
    /** When true and no background image is set, text color follows background contrast. */
    autoTextColor: boolean;
    /** 0–100; scales bookmark and UI text brightness. 100 = full chosen text color. */
    textOpacityPct: number;
    /** Bookmark / section link hover animation style. */
    linkHoverEffect: LinkHoverEffect;
    /** Grow effect size (100–115%). Only used when linkHoverEffect is "grow". */
    linkHoverGrowPct: number;
    /** Hover transition duration in ms. */
    linkHoverDurationMs: number;
  };
  background: {
    imageUrl: string;
    /** 0–100; lower values fade the image toward the theme background color. */
    imageOpacityPct: number;
    size: 'cover' | 'contain' | 'repeat' | 'auto';
    align: string;
  };
}

export interface OptionsLocalState {
  schemaVersion: number;
  customCss: string;
}

export function createDefaultLayoutState(): LayoutState {
  return {
    schemaVersion: SCHEMA_VERSION,
    columns: [
      {
        id: 'grid:special:mostVisited',
        type: 'bookmarkGrid',
        order: 0,
        enabled: false,
        stack: ['special:mostVisited'],
      },
      {
        id: 'grid:special:recentlyClosed',
        type: 'bookmarkGrid',
        order: 1,
        enabled: false,
        stack: ['special:recentlyClosed'],
      },
      {
        id: 'grid:special:apps',
        type: 'bookmarkGrid',
        order: 2,
        enabled: false,
        stack: ['special:apps'],
      },
      {
        id: 'grid:special:otherDevices',
        type: 'bookmarkGrid',
        order: 3,
        enabled: false,
        stack: ['special:otherDevices'],
      },
      { id: 'special:mostVisited', type: 'specialSection', order: 0, enabled: false, kind: 'mostVisited' },
      { id: 'special:recentlyClosed', type: 'specialSection', order: 1, enabled: false, kind: 'recentlyClosed' },
      { id: 'special:apps', type: 'specialSection', order: 2, enabled: false, kind: 'apps' },
      { id: 'special:otherDevices', type: 'specialSection', order: 3, enabled: false, kind: 'otherDevices' },
    ],
    folderState: {},
  };
}

export function createDefaultOptionsState(): OptionsState {
  return {
    schemaVersion: SCHEMA_VERSION,
    general: {
      rememberOpenFolders: true,
      openLinksInSameTab: false,
      expandCollapsedOnHover: false,
      folderCollapseAnimationMs: 250,
      lockColumns: false,
    },
    topBar: {
      itemOrder: ['search', 'clock', 'weather'],
      fullWidth: false,
      searchEnabled: true,
      searchEngine: 'browserDefault',
      searchMaxWidthPx: 1000,
      widgetHeightPx: 36,
      maxWidthPx: 720,
      gapPx: 20,
      widgetScale: 1,
    },
    theme: {
      presetId: 'night-dark',
      customSnapshot: {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontWeight: 400,
        colors: {
          text: '#e8e8f0',
          background: '#15161e',
          highlight: '#6fa8dc',
          highlightText: '#15161e',
          shadow: 'rgba(255, 255, 255, 0.12)',
        },
        autoTextColor: false,
      },
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontWeight: 400,
      fontSizePx: 14,
      colors: {
        text: '#e8e8f0',
        background: '#15161e',
        highlight: '#6fa8dc',
        highlightText: '#15161e',
        shadow: 'rgba(255, 255, 255, 0.12)',
      },
      spacing: 1,
      columnWidth: 220,
      uppercaseFolderNames: true,
      topSpacingPx: 40,
      regionGapPx: 36,
      useHighlightForFolderHeaders: false,
      folderHeaderColor: '#d0d0dc',
      autoTextColor: false,
      textOpacityPct: 100,
      linkHoverEffect: 'color',
      linkHoverGrowPct: 105,
      linkHoverDurationMs: 200,
    },
    background: {
      imageUrl: '',
      imageOpacityPct: 100,
      size: 'cover',
      align: 'center',
    },
  };
}

/** Merge stored options with defaults, including nested theme/background fields. */
export function mergeOptionsState(raw: Partial<OptionsState>): OptionsState {
  const defaults = createDefaultOptionsState();
  return {
    ...defaults,
    ...raw,
    general: { ...defaults.general, ...raw.general },
    topBar: {
      ...defaults.topBar,
      ...raw.topBar,
      searchEnabled: raw.topBar?.searchEnabled ?? defaults.topBar.searchEnabled,
      searchEngine: normalizeSearchEngine(raw.topBar?.searchEngine),
    },
    theme: {
      ...defaults.theme,
      ...raw.theme,
      textOpacityPct: clampTextOpacityPct(
        raw.theme?.textOpacityPct ?? defaults.theme.textOpacityPct
      ),
      linkHoverEffect: normalizeLinkHoverEffect(
        raw.theme?.linkHoverEffect ?? defaults.theme.linkHoverEffect
      ),
      linkHoverGrowPct: clampLinkHoverGrowPct(
        raw.theme?.linkHoverGrowPct ?? defaults.theme.linkHoverGrowPct
      ),
      linkHoverDurationMs: clampLinkHoverDurationMs(
        raw.theme?.linkHoverDurationMs ?? defaults.theme.linkHoverDurationMs
      ),
      useHighlightForFolderHeaders:
        typeof raw.theme?.useHighlightForFolderHeaders === 'boolean'
          ? raw.theme.useHighlightForFolderHeaders
          : defaults.theme.useHighlightForFolderHeaders,
      folderHeaderColor:
        typeof raw.theme?.folderHeaderColor === 'string' && raw.theme.folderHeaderColor.trim()
          ? raw.theme.folderHeaderColor
          : defaults.theme.folderHeaderColor,
      colors: { ...defaults.theme.colors, ...raw.theme?.colors },
      customSnapshot: {
        ...defaults.theme.customSnapshot,
        ...raw.theme?.customSnapshot,
        colors: {
          ...defaults.theme.customSnapshot.colors,
          ...raw.theme?.customSnapshot?.colors,
        },
      },
    },
    background: {
      ...defaults.background,
      ...raw.background,
      imageOpacityPct: snapPercent(raw.background?.imageOpacityPct ?? defaults.background.imageOpacityPct, 0, 100),
    },
  };
}

export function createDefaultOptionsLocalState(): OptionsLocalState {
  return {
    schemaVersion: SCHEMA_VERSION,
    customCss: '',
  };
}
