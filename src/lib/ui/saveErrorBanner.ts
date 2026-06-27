export function showSaveError(message: string): void {
  const app = document.getElementById('app');
  if (!app) return;

  let banner = app.querySelector<HTMLElement>('.ntp-save-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'ntp-save-error-banner';
    banner.setAttribute('role', 'alert');
    app.prepend(banner);
  }

  banner.replaceChildren();
  const text = document.createElement('p');
  text.textContent = message;
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Dismiss';
  dismiss.addEventListener('click', () => banner?.remove());
  banner.append(text, dismiss);
}
