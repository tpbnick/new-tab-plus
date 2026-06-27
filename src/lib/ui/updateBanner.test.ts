import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hideUpdateBanner, showUpdateBanner } from './updateBanner';

describe('update banner', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('shows a dismissible update banner', () => {
    const onDismiss = vi.fn();
    showUpdateBanner({
      releaseUrl: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
      latestVersion: '1.0.3',
      onDismiss,
    });

    const banner = document.querySelector('.ntp-update-banner');
    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.textContent).toContain('Update available — v1.0.3');

    banner?.querySelector<HTMLButtonElement>('.ntp-update-banner__close')?.click();
    expect(document.querySelector('.ntp-update-banner')).toBeNull();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('opens the release page when the message is clicked', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    showUpdateBanner({
      releaseUrl: 'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
      latestVersion: '1.0.3',
      onDismiss: () => {},
    });

    document.querySelector<HTMLButtonElement>('.ntp-update-banner__message')?.click();
    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/tpbnick/new-tab-plus/releases/tag/v1.0.3',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('hideUpdateBanner removes an existing banner', () => {
    showUpdateBanner({
      releaseUrl: 'https://example.com/release',
      latestVersion: '9.9.9',
      onDismiss: () => {},
    });
    hideUpdateBanner();
    expect(document.querySelector('.ntp-update-banner')).toBeNull();
  });
});
