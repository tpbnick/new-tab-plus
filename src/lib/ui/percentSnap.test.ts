import { describe, expect, it } from 'vitest';
import { snapPercent } from './percentSnap';

describe('snapPercent', () => {
  it('snaps to 5% increments within bounds', () => {
    expect(snapPercent(108, 100, 115, 5)).toBe(110);
    expect(snapPercent(100, 100, 115, 5)).toBe(100);
    expect(snapPercent(33, 30, 100, 5)).toBe(35);
    expect(snapPercent(28, 30, 100, 5)).toBe(30);
  });
});
