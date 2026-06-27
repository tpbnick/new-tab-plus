import { faviconUrl } from '../favicon';
import { trapTabKey } from '../a11y/focusTrap';
import { isTypingTarget } from '../keyboard/typingTarget';
import { searchBookmarkEntries, type BookmarkSearchEntry } from './bookmarkSearchIndex';

export interface CommandPaletteCallbacks {
  getBookmarkEntries(): BookmarkSearchEntry[];
  openUrl(url: string): void;
  searchWeb(query: string): void;
  isBlocked?(): boolean;
}

export interface CommandPaletteHandle {
  isOpen(): boolean;
  detach(): void;
}

type ResultItem =
  | { kind: 'search'; query: string }
  | { kind: 'bookmark'; entry: BookmarkSearchEntry };

function isPrintableKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.length === 1;
}

export function attachCommandPalette(callbacks: CommandPaletteCallbacks): CommandPaletteHandle {
  let open = false;
  let selectedIndex = 0;
  let results: ResultItem[] = [];
  let focusBeforeOpen: HTMLElement | null = null;

  const overlay = document.createElement('div');
  overlay.className = 'command-palette';
  overlay.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'command-palette__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Search bookmarks and the web');

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'command-palette-input';
  input.className = 'command-palette__input';
  input.placeholder = 'Search bookmarks or the web';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'command-palette-results');
  input.setAttribute('aria-label', 'Search bookmarks or the web');

  const list = document.createElement('ul');
  list.id = 'command-palette-results';
  list.className = 'command-palette__results';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Search results');

  const footer = document.createElement('div');
  footer.className = 'command-palette__footer';
  footer.textContent = '↑↓ navigate · Enter open · Esc close';

  panel.append(input, list, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function buildResults(query: string): ResultItem[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const items: ResultItem[] = [{ kind: 'search', query: trimmed }];
    for (const entry of searchBookmarkEntries(callbacks.getBookmarkEntries(), trimmed)) {
      items.push({ kind: 'bookmark', entry });
    }
    return items;
  }

  function updateActiveDescendant(): void {
    if (results.length === 0) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('aria-activedescendant', `command-palette-option-${selectedIndex}`);
  }

  function renderResults(): void {
    list.innerHTML = '';
    if (results.length === 0) {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      return;
    }

    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    selectedIndex = Math.min(selectedIndex, results.length - 1);

    results.forEach((item, index) => {
      const li = document.createElement('li');
      li.id = `command-palette-option-${index}`;
      li.className = 'command-palette__item';
      li.setAttribute('role', 'option');
      li.dataset.index = String(index);
      const isSelected = index === selectedIndex;
      if (isSelected) {
        li.classList.add('command-palette__item--active');
        li.setAttribute('aria-selected', 'true');
      } else {
        li.setAttribute('aria-selected', 'false');
      }

      if (item.kind === 'search') {
        li.dataset.kind = 'search';
        li.innerHTML = `<span class="command-palette__label">Search the web for "<strong>${escapeHtml(item.query)}</strong>"</span>`;
      } else {
        li.dataset.kind = 'bookmark';
        li.dataset.url = item.entry.url;

        const icon = document.createElement('img');
        icon.className = 'command-palette__favicon';
        icon.src = faviconUrl(item.entry.url);
        icon.width = 16;
        icon.height = 16;
        icon.alt = '';

        const label = document.createElement('span');
        label.className = 'command-palette__label';
        label.textContent = item.entry.title;

        const path = document.createElement('span');
        path.className = 'command-palette__path';
        path.textContent = item.entry.path;

        li.append(icon, label, path);
      }

      li.addEventListener('mousedown', (event) => {
        event.preventDefault();
        selectedIndex = index;
        activateSelected();
      });

      list.appendChild(li);
    });

    updateActiveDescendant();
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function syncResults(resetSelection = true): void {
    results = buildResults(input.value);
    if (resetSelection) selectedIndex = 0;
    renderResults();
  }

  function show(initialQuery = ''): void {
    focusBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    open = true;
    overlay.hidden = false;
    document.body.classList.add('is-command-palette-open');
    input.value = initialQuery;
    syncResults(true);
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  function close(): void {
    window.clearTimeout(inputDebounceTimer);
    open = false;
    overlay.hidden = true;
    document.body.classList.remove('is-command-palette-open');
    input.value = '';
    results = [];
    selectedIndex = 0;
    list.innerHTML = '';
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    focusBeforeOpen?.focus();
    focusBeforeOpen = null;
  }

  function activateSelected(): void {
    const item = results[selectedIndex];
    if (!item) return;

    if (item.kind === 'search') {
      callbacks.searchWeb(item.query);
    } else {
      callbacks.openUrl(item.entry.url);
    }
    close();
  }

  function moveSelection(delta: number): void {
    if (results.length === 0) return;
    selectedIndex = (selectedIndex + delta + results.length) % results.length;
    renderResults();
    list.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function onDocumentKeyDown(event: KeyboardEvent): void {
    if (callbacks.isBlocked?.()) return;

    if (open) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      trapTabKey(panel, event);
      return;
    }

    if (!isPrintableKey(event)) return;
    if (isTypingTarget(event.target)) return;

    event.preventDefault();
    show(event.key);
  }

  function onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      activateSelected();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  let inputDebounceTimer: number | undefined;

  function onInput(): void {
    window.clearTimeout(inputDebounceTimer);
    inputDebounceTimer = window.setTimeout(() => syncResults(true), 75);
  }

  function onOverlayMouseDown(event: MouseEvent): void {
    if (event.target === overlay) close();
  }

  input.addEventListener('keydown', onInputKeyDown);
  input.addEventListener('input', onInput);
  overlay.addEventListener('mousedown', onOverlayMouseDown);
  document.addEventListener('keydown', onDocumentKeyDown);

  return {
    isOpen: () => open,
    detach: () => {
      window.clearTimeout(inputDebounceTimer);
      document.removeEventListener('keydown', onDocumentKeyDown);
      input.removeEventListener('keydown', onInputKeyDown);
      input.removeEventListener('input', onInput);
      overlay.removeEventListener('mousedown', onOverlayMouseDown);
      close();
      overlay.remove();
    },
  };
}
