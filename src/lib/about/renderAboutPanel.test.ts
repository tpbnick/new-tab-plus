import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHROME_WEB_STORE_URL } from './appMeta.generated';
import { renderAboutPanel } from './renderAboutPanel';
import { createDefaultOptionsState } from '../storage/schema';

describe('renderAboutPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('includes a Chrome Web Store listing link', () => {
    const container = document.createElement('div');
    renderAboutPanel(container, {
      options: createDefaultOptionsState(),
      saveOptionsNow: vi.fn(),
    });

    const link = [...container.querySelectorAll<HTMLAnchorElement>('a')].find(
      (anchor) => anchor.href === CHROME_WEB_STORE_URL
    );

    expect(link).toBeDefined();
    expect(link?.textContent).toBe('View listing');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
  });
});
