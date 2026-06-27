export function normalizeVersionTag(version: string): string {
  return version.trim().replace(/^v/i, '');
}

export function parseVersion(version: string): [number, number, number] | null {
  const cleaned = normalizeVersionTag(version);
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(cleaned);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isVersionNewer(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  if (!latestParts || !currentParts) return false;

  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }
  return false;
}
