import type { SpecialSectionMeta } from '../storage/schema';
import type { SectionItem } from './mostVisited';
import { getMostVisited } from './mostVisited';
import { getRecentlyClosed } from './recentlyClosed';
import { getOtherDevices } from './otherDevices';
import { getAppsTile } from './appsTile';

export interface SectionGroupViewModel {
  title: string;
  items: SectionItem[];
}

export interface SpecialSectionViewModel {
  id: string;
  title: string;
  groups: SectionGroupViewModel[];
}

export const SECTION_TITLES: Record<SpecialSectionMeta['kind'], string> = {
  mostVisited: 'Most Visited',
  recentlyClosed: 'Recently Closed',
  apps: 'Apps',
  otherDevices: 'Other Devices',
};

export async function loadSpecialSection(meta: SpecialSectionMeta): Promise<SpecialSectionViewModel> {
  const title = SECTION_TITLES[meta.kind];

  switch (meta.kind) {
    case 'mostVisited': {
      const items = await getMostVisited(meta.itemCount);
      return { id: meta.id, title, groups: [{ title: '', items }] };
    }
    case 'recentlyClosed': {
      const items = await getRecentlyClosed(meta.itemCount);
      return { id: meta.id, title, groups: [{ title: '', items }] };
    }
    case 'apps': {
      return { id: meta.id, title, groups: [{ title: '', items: getAppsTile() }] };
    }
    case 'otherDevices': {
      const devices = await getOtherDevices(meta.itemCount);
      return {
        id: meta.id,
        title,
        groups: devices.map((d) => ({ title: d.deviceName, items: d.tabs })),
      };
    }
  }
}
