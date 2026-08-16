import { describe, expect, it } from 'vitest';
import { renderSearchBar } from './searchBar';

describe('renderSearchBar', () => {
  it('exposes search tips as a tooltip described by the help button', () => {
    const { element, destroy } = renderSearchBar(() => 'google');
    const helpBtn = element.querySelector<HTMLButtonElement>('.search-bar__help');
    const popover = element.querySelector<HTMLElement>('.search-bar__help-popover');
    expect(helpBtn?.getAttribute('aria-describedby')).toBeNull();
    expect(popover?.getAttribute('role')).toBe('tooltip');
    helpBtn?.click();
    expect(helpBtn?.getAttribute('aria-describedby')).toBe('search-bar-help-popover');
    expect(popover?.hidden).toBe(false);
    destroy();
  });
});
