import { parseSafeUrl } from '../urlSafety';

export interface UpdateBannerOptions {
  releaseUrl: string;
  latestVersion: string;
  onDismiss: () => void;
}

function isSafeReleaseUrl(url: string): boolean {
  const parsed = parseSafeUrl(url);
  return parsed !== null && parsed.protocol === 'https:';
}

export function hideUpdateBanner(): void {
  document.querySelector('.ntp-update-banner')?.remove();
}

export function showUpdateBanner({ releaseUrl, latestVersion, onDismiss }: UpdateBannerOptions): void {
  hideUpdateBanner();

  const banner = document.createElement('div');
  banner.className = 'ntp-update-banner';
  banner.setAttribute('role', 'status');

  const message = document.createElement('button');
  message.type = 'button';
  message.className = 'ntp-update-banner__message';
  message.textContent = `Update available — v${latestVersion}`;
  message.addEventListener('click', () => {
    if (!isSafeReleaseUrl(releaseUrl)) return;
    window.open(releaseUrl, '_blank', 'noopener,noreferrer');
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ntp-update-banner__close';
  close.setAttribute('aria-label', 'Dismiss update notice');
  close.textContent = '×';
  close.addEventListener('click', () => {
    banner.remove();
    onDismiss();
  });

  banner.append(message, close);
  document.body.appendChild(banner);
}
