export const SEARCH_ENGINES = ['browserDefault', 'google', 'duckduckgo', 'bing', 'brave'] as const;
export type SearchEngineId = (typeof SEARCH_ENGINES)[number];

export const SEARCH_ENGINE_LABELS: Record<SearchEngineId, string> = {
  browserDefault: 'Browser default',
  google: 'Google',
  duckduckgo: 'DuckDuckGo',
  bing: 'Bing',
  brave: 'Brave',
};

export function normalizeSearchEngine(value: unknown): SearchEngineId {
  if (typeof value === 'string' && (SEARCH_ENGINES as readonly string[]).includes(value)) {
    return value as SearchEngineId;
  }
  return 'browserDefault';
}

export function buildSearchUrl(engine: SearchEngineId, query: string): string {
  const q = encodeURIComponent(query.trim());
  switch (engine) {
    case 'browserDefault':
      throw new Error('Browser default searches use chrome.search.query');
    case 'google':
      return `https://www.google.com/search?q=${q}`;
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${q}`;
    case 'bing':
      return `https://www.bing.com/search?q=${q}`;
    case 'brave':
      return `https://search.brave.com/search?q=${q}`;
  }
}

export function openWebSearch(engine: SearchEngineId, query: string): void {
  const text = query.trim();
  if (!text) return;
  if (engine === 'browserDefault') {
    void chrome.search.query({ text, disposition: 'CURRENT_TAB' });
    return;
  }
  window.location.href = buildSearchUrl(engine, text);
}
