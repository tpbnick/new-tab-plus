import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderBookmarkLinkItem } from './bookmarkLink';

describe('renderBookmarkLinkItem', () => {
  const update = vi.fn();
  const create = vi.fn();

  beforeEach(() => {
    update.mockReset().mockResolvedValue({});
    create.mockReset().mockResolvedValue({});
    vi.stubGlobal('chrome', {
      runtime: { getURL: (path: string) => `chrome-extension://test${path}` },
      tabs: { update, create },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prevents navigation and omits target/rel for unsafe URLs', () => {
    const li = renderBookmarkLinkItem(
      { title: 'Bad', url: 'javascript:alert(1)' },
      { openLinksInSameTab: false }
    );
    const link = li.querySelector<HTMLAnchorElement>('a.bookmark-link')!;

    expect(link.getAttribute('href')).toBe('#');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('configures target and rel for normal external URLs', () => {
    const li = renderBookmarkLinkItem(
      { title: 'Docs', url: 'https://example.com' },
      { openLinksInSameTab: false }
    );
    const link = li.querySelector<HTMLAnchorElement>('a.bookmark-link')!;

    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('navigates chrome:// URLs via chrome.tabs on click and middle-click', () => {
    const li = renderBookmarkLinkItem(
      { title: 'Apps', url: 'chrome://apps/' },
      { openLinksInSameTab: true }
    );
    const link = li.querySelector<HTMLAnchorElement>('a.bookmark-link')!;

    const leftClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(leftClick);
    expect(leftClick.defaultPrevented).toBe(true);
    expect(update).toHaveBeenCalledWith({ url: 'chrome://apps/' });

    const ctrlClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    link.dispatchEvent(ctrlClick);
    expect(ctrlClick.defaultPrevented).toBe(true);
    expect(create).toHaveBeenCalledWith({ url: 'chrome://apps/' });

    create.mockClear();
    const middleClick = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
    link.dispatchEvent(middleClick);
    expect(middleClick.defaultPrevented).toBe(true);
    expect(create).toHaveBeenCalledWith({ url: 'chrome://apps/' });
  });

  it('opens chrome:// URLs in a new tab when openLinksInSameTab is false', () => {
    const li = renderBookmarkLinkItem(
      { title: 'Apps', url: 'chrome://apps/' },
      { openLinksInSameTab: false }
    );
    const link = li.querySelector<HTMLAnchorElement>('a.bookmark-link')!;

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(create).toHaveBeenCalledWith({ url: 'chrome://apps/' });
    expect(update).not.toHaveBeenCalled();
  });
});
