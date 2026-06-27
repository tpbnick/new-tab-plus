import type { SectionItem } from './mostVisited';

export function getAppsTile(): SectionItem[] {
  return [{ title: 'Apps', url: 'chrome://apps/' }];
}
