import { beforeEach, describe, expect, it } from 'vitest';
import { LayoutPersistError } from '../storage/layoutPersistError';
import { showSaveError } from './saveErrorBanner';

describe('showSaveError', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('shows a dismissible alert banner in #app', () => {
    showSaveError('Could not save layout.');

    const banner = document.querySelector('.ntp-save-error-banner');
    expect(banner).toBeTruthy();
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.textContent).toContain('Could not save layout.');

    const dismiss = banner?.querySelector('button');
    expect(dismiss?.textContent).toBe('Dismiss');
    dismiss?.click();
    expect(document.querySelector('.ntp-save-error-banner')).toBeNull();
  });

  it('reuses the same banner element when called again', () => {
    showSaveError('First message');
    const first = document.querySelector('.ntp-save-error-banner');
    showSaveError('Second message');
    const second = document.querySelector('.ntp-save-error-banner');
    expect(second).toBe(first);
    expect(second?.textContent).toContain('Second message');
  });
});

describe('layout persist error chain', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  async function persistLayoutLike(setLayout: () => Promise<void>): Promise<void> {
    try {
      await setLayout();
    } catch (err) {
      showSaveError('Could not save layout. Check Chrome sync storage space.');
      throw new LayoutPersistError(err);
    }
  }

  it('shows one banner when persist fails with LayoutPersistError', async () => {
    await expect(
      persistLayoutLike(async () => {
        throw new Error('quota');
      })
    ).rejects.toBeInstanceOf(LayoutPersistError);

    expect(document.querySelectorAll('.ntp-save-error-banner')).toHaveLength(1);
  });

  it('skips a duplicate banner in outer catch when LayoutPersistError is thrown', async () => {
    const outerCatch = async (): Promise<void> => {
      try {
        await persistLayoutLike(async () => {
          throw new Error('quota');
        });
      } catch (err) {
        if (!(err instanceof LayoutPersistError)) {
          showSaveError('Could not save folder state.');
        }
      }
    };

    await outerCatch();
    expect(document.querySelector('.ntp-save-error-banner')?.textContent).toContain(
      'Could not save layout'
    );
    expect(document.querySelector('.ntp-save-error-banner')?.textContent).not.toContain(
      'folder state'
    );
  });
});
