import { openWebSearch, type SearchEngineId } from './searchEngine';

export function renderSearchBar(getSearchEngine: () => SearchEngineId): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'search-bar-wrap';

  const form = document.createElement('form');
  form.className = 'search-bar';

  const field = document.createElement('div');
  field.className = 'search-bar__field';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-bar__input';
  input.placeholder = 'Search the web';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Search the web');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    openWebSearch(getSearchEngine(), input.value);
  });

  const helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.className = 'search-bar__help';
  helpBtn.textContent = '?';
  helpBtn.setAttribute('aria-label', 'Search tips');
  helpBtn.setAttribute('aria-expanded', 'false');
  helpBtn.setAttribute('aria-controls', 'search-bar-help-popover');

  const popover = document.createElement('div');
  popover.id = 'search-bar-help-popover';
  popover.className = 'search-bar__help-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Search tips');

  const helpText = document.createElement('p');
  helpText.className = 'search-bar__help-text';
  helpText.textContent =
    'Type anywhere on the page (outside a text field) to search your bookmarks. This bar searches the web.';
  popover.appendChild(helpText);

  let dismissClick: ((event: MouseEvent) => void) | null = null;
  let dismissEscape: ((event: KeyboardEvent) => void) | null = null;

  const closeHelp = (): void => {
    popover.hidden = true;
    helpBtn.setAttribute('aria-expanded', 'false');
    if (dismissClick) {
      document.removeEventListener('click', dismissClick);
      dismissClick = null;
    }
    if (dismissEscape) {
      document.removeEventListener('keydown', dismissEscape);
      dismissEscape = null;
    }
  };

  const openHelp = (): void => {
    popover.hidden = false;
    helpBtn.setAttribute('aria-expanded', 'true');
    dismissClick = (event: MouseEvent) => {
      if (!field.contains(event.target as Node)) closeHelp();
    };
    dismissEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeHelp();
      }
    };
    requestAnimationFrame(() => {
      if (dismissClick) document.addEventListener('click', dismissClick);
      if (dismissEscape) document.addEventListener('keydown', dismissEscape);
    });
  };

  helpBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (popover.hidden) openHelp();
    else closeHelp();
  });

  field.append(input, helpBtn, popover);
  form.appendChild(field);
  wrap.appendChild(form);
  return wrap;
}
