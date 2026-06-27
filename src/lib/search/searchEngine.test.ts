import { describe, expect, it } from 'vitest';
import { buildSearchUrl, normalizeSearchEngine } from './searchEngine';

describe('searchEngine', () => {
  it('normalizes unknown engines to browser default', () => {
    expect(normalizeSearchEngine('browserDefault')).toBe('browserDefault');
    expect(normalizeSearchEngine('google')).toBe('google');
    expect(normalizeSearchEngine('invalid')).toBe('browserDefault');
  });

  it('builds search urls for supported engines', () => {
    expect(buildSearchUrl('google', 'hello world')).toBe(
      'https://www.google.com/search?q=hello%20world'
    );
    expect(buildSearchUrl('duckduckgo', 'cats')).toBe('https://duckduckgo.com/?q=cats');
    expect(buildSearchUrl('bing', 'cats')).toBe('https://www.bing.com/search?q=cats');
    expect(buildSearchUrl('brave', 'cats')).toBe('https://search.brave.com/search?q=cats');
  });
});
