import { clampTextOpacityPct } from '../theme/colorUtils';
import {
  clampLinkHoverDurationMs,
  clampLinkHoverGrowPct,
  normalizeLinkHoverEffect,
  type LinkHoverEffect,
} from '../theme/linkHover';
import { clampTopBarOptions, normalizeTopBarItemOrder } from '../topBar/topBarLayout';
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
    /** When true, check GitHub releases for extension updates. */
    checkForUpdates: boolean;
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
  /** Latest release version the user dismissed from the update banner. */
  dismissedUpdateVersion: string;
  /**
   * Older builds mirrored every edit to Chrome sync while this was true.
   * New edits stay on this device; cloud copies are explicit Save / Restore.
   */
  syncToCloud: boolean;
  /** data: URL for an uploaded background. Stays on this device; never synced. */
  uploadedBackgroundImage: string;
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
      checkForUpdates: true,
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

const VALID_BACKGROUND_SIZES = new Set<OptionsState['background']['size']>([
  'cover',
  'contain',
  'repeat',
  'auto',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {};
}

function mergeThemeColors(
  raw: unknown,
  defaults: OptionsState['theme']['colors']
): OptionsState['theme']['colors'] {
  const src = asRecord(raw);
  return {
    text: asNonEmptyString(src.text, defaults.text),
    background: asNonEmptyString(src.background, defaults.background),
    highlight: asNonEmptyString(src.highlight, defaults.highlight),
    highlightText: asNonEmptyString(src.highlightText, defaults.highlightText),
    shadow: asNonEmptyString(src.shadow, defaults.shadow),
  };
}

/** Merge stored options with defaults, including nested theme/background fields. */
export function mergeOptionsState(raw: Partial<OptionsState>): OptionsState {
  const defaults = createDefaultOptionsState();
  const root = asRecord(raw);
  const rawGeneral = asRecord(root.general);
  const rawTopBar = asRecord(root.topBar);
  const rawTheme = asRecord(root.theme);
  const rawCustomSnapshot = asRecord(rawTheme.customSnapshot);
  const rawBackground = asRecord(root.background);

  const rawItemOrder = Array.isArray(rawTopBar.itemOrder)
    ? rawTopBar.itemOrder.filter((id): id is TopBarItemId => typeof id === 'string')
    : undefined;

  const rawBgSize = rawBackground.size;
  const backgroundSize: OptionsState['background']['size'] =
    typeof rawBgSize === 'string' &&
    VALID_BACKGROUND_SIZES.has(rawBgSize as OptionsState['background']['size'])
      ? (rawBgSize as OptionsState['background']['size'])
      : defaults.background.size;

  return {
    schemaVersion: SCHEMA_VERSION,
    general: {
      rememberOpenFolders: asBoolean(rawGeneral.rememberOpenFolders, defaults.general.rememberOpenFolders),
      openLinksInSameTab: asBoolean(rawGeneral.openLinksInSameTab, defaults.general.openLinksInSameTab),
      expandCollapsedOnHover: asBoolean(
        rawGeneral.expandCollapsedOnHover,
        defaults.general.expandCollapsedOnHover
      ),
      folderCollapseAnimationMs: asFiniteNumber(
        rawGeneral.folderCollapseAnimationMs,
        defaults.general.folderCollapseAnimationMs
      ),
      lockColumns: asBoolean(rawGeneral.lockColumns, defaults.general.lockColumns),
      checkForUpdates: asBoolean(rawGeneral.checkForUpdates, defaults.general.checkForUpdates),
    },
    topBar: clampTopBarOptions({
      itemOrder: normalizeTopBarItemOrder(rawItemOrder),
      fullWidth: asBoolean(rawTopBar.fullWidth, defaults.topBar.fullWidth),
      searchEnabled: asBoolean(rawTopBar.searchEnabled, defaults.topBar.searchEnabled),
      searchEngine: normalizeSearchEngine(rawTopBar.searchEngine),
      searchMaxWidthPx: asFiniteNumber(rawTopBar.searchMaxWidthPx, defaults.topBar.searchMaxWidthPx),
      widgetHeightPx: asFiniteNumber(rawTopBar.widgetHeightPx, defaults.topBar.widgetHeightPx),
      maxWidthPx: asFiniteNumber(rawTopBar.maxWidthPx, defaults.topBar.maxWidthPx),
      gapPx: asFiniteNumber(rawTopBar.gapPx, defaults.topBar.gapPx),
      widgetScale: asFiniteNumber(rawTopBar.widgetScale, defaults.topBar.widgetScale),
    }),
    theme: {
      presetId: asNonEmptyString(rawTheme.presetId, defaults.theme.presetId),
      customSnapshot: {
        fontFamily: asNonEmptyString(
          rawCustomSnapshot.fontFamily,
          defaults.theme.customSnapshot.fontFamily
        ),
        fontWeight: asFiniteNumber(
          rawCustomSnapshot.fontWeight,
          defaults.theme.customSnapshot.fontWeight
        ),
        colors: mergeThemeColors(rawCustomSnapshot.colors, defaults.theme.customSnapshot.colors),
        autoTextColor: asBoolean(
          rawCustomSnapshot.autoTextColor,
          defaults.theme.customSnapshot.autoTextColor
        ),
      },
      fontFamily: asNonEmptyString(rawTheme.fontFamily, defaults.theme.fontFamily),
      fontWeight: asFiniteNumber(rawTheme.fontWeight, defaults.theme.fontWeight),
      fontSizePx: asFiniteNumber(rawTheme.fontSizePx, defaults.theme.fontSizePx),
      colors: mergeThemeColors(rawTheme.colors, defaults.theme.colors),
      spacing: asFiniteNumber(rawTheme.spacing, defaults.theme.spacing),
      columnWidth: asFiniteNumber(rawTheme.columnWidth, defaults.theme.columnWidth),
      uppercaseFolderNames: asBoolean(
        rawTheme.uppercaseFolderNames,
        defaults.theme.uppercaseFolderNames
      ),
      topSpacingPx: asFiniteNumber(rawTheme.topSpacingPx, defaults.theme.topSpacingPx),
      regionGapPx: asFiniteNumber(rawTheme.regionGapPx, defaults.theme.regionGapPx),
      useHighlightForFolderHeaders: asBoolean(
        rawTheme.useHighlightForFolderHeaders,
        defaults.theme.useHighlightForFolderHeaders
      ),
      folderHeaderColor: asNonEmptyString(
        rawTheme.folderHeaderColor,
        defaults.theme.folderHeaderColor
      ),
      autoTextColor: asBoolean(rawTheme.autoTextColor, defaults.theme.autoTextColor),
      textOpacityPct: clampTextOpacityPct(
        asFiniteNumber(rawTheme.textOpacityPct, defaults.theme.textOpacityPct)
      ),
      linkHoverEffect: normalizeLinkHoverEffect(rawTheme.linkHoverEffect),
      linkHoverGrowPct: clampLinkHoverGrowPct(
        asFiniteNumber(rawTheme.linkHoverGrowPct, defaults.theme.linkHoverGrowPct)
      ),
      linkHoverDurationMs: clampLinkHoverDurationMs(
        asFiniteNumber(rawTheme.linkHoverDurationMs, defaults.theme.linkHoverDurationMs)
      ),
    },
    background: {
      imageUrl: asString(rawBackground.imageUrl, defaults.background.imageUrl),
      imageOpacityPct: snapPercent(
        asFiniteNumber(rawBackground.imageOpacityPct, defaults.background.imageOpacityPct),
        0,
        100
      ),
      size: backgroundSize,
      align: asNonEmptyString(rawBackground.align, defaults.background.align),
    },
  };
}

export function createDefaultOptionsLocalState(): OptionsLocalState {
  return {
    schemaVersion: SCHEMA_VERSION,
    customCss: '',
    dismissedUpdateVersion: '',
    syncToCloud: false,
    uploadedBackgroundImage: '',
  };
}
