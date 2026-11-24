import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachCommandPalette } from './commandPalette';
import type { BookmarkSearchEntry } from './bookmarkSearchIndex';

const entries: BookmarkSearchEntry[] = [
  { id: '1', title: 'GitHub', url: 'https://github.com/', path: 'Dev' },
];

describe('attachCommandPalette integration', () => {
  let palette: ReturnType<typeof attachCommandPalette>;

  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test${path}`,
      },
    });
    document.body.innerHTML = '<button id="focus-me">Page</button>';
  });

  afterEach(() => {
    palette?.detach();
  });

  function mountPalette(overrides: Partial<Parameters<typeof attachCommandPalette>[0]> = {}) {
    palette = attachCommandPalette({
      getBookmarkEntries: () => entries,
      openUrl: vi.fn(),
      searchWeb: vi.fn(),
      ...overrides,
    });
  }

  it('opens on a printable key and focuses the input', () => {
    mountPalette();
    document.getElementById('focus-me')?.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));

    expect(palette.isOpen()).toBe(true);
    expect((document.querySelector('.command-palette') as HTMLElement).hidden).toBe(false);
    expect(document.activeElement?.classList.contains('command-palette__input')).toBe(true);
  });

  it('searches bookmarks and opens a selected result on Enter', async () => {
    vi.useFakeTimers();
    const openUrl = vi.fn();
    mountPalette({ openUrl });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    const input = document.querySelector<HTMLInputElement>('.command-palette__input')!;
    input.value = 'github';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(openUrl).toHaveBeenCalledWith('https://github.com/');
    expect(palette.isOpen()).toBe(false);
    vi.useRealTimers();
  });

  it('closes on Escape and restores focus', () => {
    mountPalette();
    const trigger = document.getElementById('focus-me') as HTMLButtonElement;
    trigger.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
    const input = document.querySelector<HTMLInputElement>('.command-palette__input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(palette.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('does not open when blocked', () => {
    mountPalette({ isBlocked: () => true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    expect(palette.isOpen()).toBe(false);
  });

  it('does not open on ? so settings can use that shortcut', () => {
    mountPalette();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(palette.isOpen()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
    expect(palette.isOpen()).toBe(false);
  });

  it('does not open on Space so buttons and page scrolling still work', () => {
    mountPalette();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(palette.isOpen()).toBe(false);
  });

  it('ignores IME composing keydown events on document and input', () => {
    const searchWeb = vi.fn();
    mountPalette({ searchWeb });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', isComposing: true, bubbles: true })
    );
    expect(palette.isOpen()).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    const input = document.querySelector<HTMLInputElement>('.command-palette__input')!;
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })
    );
    expect(palette.isOpen()).toBe(true);
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it('flushes pending input debounce synchronously on Enter and arrow navigation', () => {
    vi.useFakeTimers();
    const openUrl = vi.fn();
    mountPalette({ openUrl });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    const input = document.querySelector<HTMLInputElement>('.command-palette__input')!;
    input.value = 'github';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Immediately press ArrowDown + Enter before the 75ms debounce fires
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(openUrl).toHaveBeenCalledWith('https://github.com/');
    expect(palette.isOpen()).toBe(false);
    vi.useRealTimers();
  });

  it('updates selection classes and aria attributes in place without rebuilding list items', () => {
    mountPalette();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));

    const input = document.querySelector<HTMLInputElement>('.command-palette__input')!;
    const list = document.querySelector<HTMLUListElement>('.command-palette__results')!;
    const initialItems = Array.from(list.children);
    expect(initialItems.length).toBe(2);
    expect(initialItems[0]!.classList.contains('command-palette__item--active')).toBe(true);
    expect(initialItems[0]!.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-palette-option-0');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(list.children[0]).toBe(initialItems[0]);
    expect(list.children[1]).toBe(initialItems[1]);
    expect(initialItems[0]!.classList.contains('command-palette__item--active')).toBe(false);
    expect(initialItems[0]!.getAttribute('aria-selected')).toBe('false');
    expect(initialItems[1]!.classList.contains('command-palette__item--active')).toBe(true);
    expect(initialItems[1]!.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-palette-option-1');
  });
});
