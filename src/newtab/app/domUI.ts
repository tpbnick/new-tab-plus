export interface Regions {
  topBar: HTMLElement;
  bookmarksGrid: HTMLElement;
}

export function applyExtensionPageIcon(): void {
  const href = chrome.runtime.getURL('icons/icon-128.png');
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function showRenderError(message: string, onRetry: () => void): void {
  const app = document.getElementById('app');
  if (!app) return;

  let banner = app.querySelector<HTMLElement>('.ntp-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'ntp-error-banner';
    banner.setAttribute('role', 'alert');
    app.prepend(banner);
  }

  banner.replaceChildren();
  const text = document.createElement('p');
  text.textContent = message;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry';
  retry.addEventListener('click', () => {
    banner?.remove();
    onRetry();
  });
  banner.append(text, retry);
}

export function clearRenderError(): void {
  document.querySelector('.ntp-error-banner')?.remove();
}

export function renderSettingsButton(onClick: () => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'settings-button';
  button.setAttribute('aria-label', 'Open settings');
  button.title = 'Settings (?)';
  button.textContent = '⚙';
  button.addEventListener('click', onClick);
  return button;
}

export function ensureRegions(app: HTMLElement): Regions {
  app.querySelector('.sections-row')?.remove();

  let main = app.querySelector<HTMLElement>('.ntp-main');
  if (!main) {
    main = document.createElement('div');
    main.className = 'ntp-main';

    const existingTopBar = app.querySelector('.top-bar');
    const existingGrid = app.querySelector('.bookmarks-grid');

    if (existingTopBar || existingGrid) {
      app.appendChild(main);
      if (existingTopBar) main.appendChild(existingTopBar);
      if (existingGrid) main.appendChild(existingGrid);
    } else {
      app.innerHTML = '';
      app.appendChild(main);
    }
  }

  let topBar = main.querySelector<HTMLElement>('.top-bar');
  let bookmarksGrid = main.querySelector<HTMLElement>('.bookmarks-grid');

  if (!topBar) {
    topBar = document.createElement('div');
    topBar.className = 'top-bar';
    main.insertBefore(topBar, bookmarksGrid);
  }

  if (!bookmarksGrid) {
    bookmarksGrid = document.createElement('div');
    bookmarksGrid.className = 'bookmarks-grid';
    main.appendChild(bookmarksGrid);
  }

  return { topBar, bookmarksGrid };
}
