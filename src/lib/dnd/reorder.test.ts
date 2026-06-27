import { describe, expect, it } from 'vitest';
import { reorderIds } from './reorder';

describe('reorderIds', () => {
  it('moves an item before a target', () => {
    expect(reorderIds(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('moves an item to the end when beforeId is null', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']);
  });

  it('moves an item to the end when beforeId is not found', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 'missing')).toEqual(['b', 'c', 'a']);
  });

  it('inserts an item that is not yet in the list (cross-column move)', () => {
    expect(reorderIds(['a', 'b', 'c'], 'new', 'b')).toEqual(['a', 'new', 'b', 'c']);
    expect(reorderIds(['a', 'b', 'c'], 'new', null)).toEqual(['a', 'b', 'c', 'new']);
  });

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c'];
    reorderIds(input, 'c', 'a');
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('handles moving an item one position forward', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c']);
  });
});
