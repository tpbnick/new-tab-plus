export interface SectionItem {
  title: string;
  url: string;
  /** When set, clicking restores this closed session instead of navigating to url. */
  sessionId?: string;
}

export async function getMostVisited(itemCount = 8): Promise<SectionItem[]> {
  const sites = await chrome.topSites.get();
  return sites.slice(0, itemCount).map((s) => ({ title: s.title, url: s.url }));
}
