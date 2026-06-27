import { describe, expect, it } from 'vitest';
import { isVersionNewer, normalizeVersionTag, parseVersion } from './compareVersions';

describe('compareVersions', () => {
  it('normalizes leading v prefix', () => {
    expect(normalizeVersionTag('v1.0.2')).toBe('1.0.2');
  });

  it('parses semver triples', () => {
    expect(parseVersion('v1.0.2')).toEqual([1, 0, 2]);
  });

  it('detects newer patch/minor/major versions', () => {
    expect(isVersionNewer('1.0.3', '1.0.2')).toBe(true);
    expect(isVersionNewer('1.1.0', '1.0.9')).toBe(true);
    expect(isVersionNewer('2.0.0', '1.9.9')).toBe(true);
  });

  it('returns false for same or older versions', () => {
    expect(isVersionNewer('1.0.2', '1.0.2')).toBe(false);
    expect(isVersionNewer('1.0.1', '1.0.2')).toBe(false);
  });
});
