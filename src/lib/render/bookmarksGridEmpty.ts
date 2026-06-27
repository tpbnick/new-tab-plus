export function renderBookmarksGridEmpty(onOpenSettings: () => void): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'bookmarks-grid-empty';

  const message = document.createElement('p');
  message.className = 'bookmarks-grid-empty__message';
  message.textContent = 'Nothing to show yet. Enable sections or add bookmarks in Chrome.';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bookmarks-grid-empty__action';
  button.textContent = 'Open settings';
  button.addEventListener('click', onOpenSettings);

  empty.append(message, button);
  return empty;
}
