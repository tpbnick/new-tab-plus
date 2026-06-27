import { describe, expect, it } from 'vitest';
import { fnv1aHash } from './fnv1aHash';

describe('fnv1aHash', () => {
  it('returns stable hashes for the same input', () => {
    expect(fnv1aHash('hello')).toBe(fnv1aHash('hello'));
  });

  it('returns different hashes for different inputs', () => {
    expect(fnv1aHash('hello')).not.toBe(fnv1aHash('world'));
  });
});
