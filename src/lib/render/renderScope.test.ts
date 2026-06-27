import { describe, expect, it } from 'vitest';
import { coalesceRenderScope } from './renderScope';

describe('coalesceRenderScope', () => {
  it('defaults bookmark requests to bookmark scope', () => {
    expect(coalesceRenderScope(null, 'bookmarks')).toBe('bookmarks');
  });

  it('escalates to full when any full request arrives', () => {
    expect(coalesceRenderScope('bookmarks', 'full')).toBe('full');
    expect(coalesceRenderScope(null, 'full')).toBe('full');
  });

  it('keeps full scope when bookmark requests follow', () => {
    expect(coalesceRenderScope('full', 'bookmarks')).toBe('full');
  });

  it('stays on bookmarks when coalescing bookmark requests', () => {
    expect(coalesceRenderScope('bookmarks', 'bookmarks')).toBe('bookmarks');
  });
});
