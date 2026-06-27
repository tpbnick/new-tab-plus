import type { SectionItem } from './mostVisited';
import { resolveRecentlyClosedUrl, shouldSkipRecentlyClosedEntry } from './recentlyClosed';

export interface DeviceGroup {
  deviceName: string;
  tabs: SectionItem[];
}

export async function getOtherDevices(maxTabsPerDevice = 8): Promise<DeviceGroup[]> {
  const devices = await chrome.sessions.getDevices({ maxResults: 10 });

  return devices
    .map((device) => ({
      deviceName: device.deviceName,
      tabs: (device.sessions ?? [])
        .flatMap((session) => session.window?.tabs ?? [])
        .map((tab) => ({ tab, url: resolveRecentlyClosedUrl(tab) }))
        .filter(({ tab, url }) => url && !shouldSkipRecentlyClosedEntry(tab.title, url))
        .slice(0, maxTabsPerDevice)
        .map(({ tab, url }) => ({ title: tab.title || url || 'Untitled', url })),
    }))
    .filter((device) => device.tabs.length > 0);
}
