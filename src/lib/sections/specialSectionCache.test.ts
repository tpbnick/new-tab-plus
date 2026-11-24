import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpecialSectionMeta } from '../storage/schema';
import type { SpecialSectionViewModel } from './index';

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>();
  return {
    ...actual,
    loadSpecialSection: vi.fn(),
  };
});

import { loadSpecialSection } from './index';
import { invalidateSpecialSectionCache, loadSpecialSectionCached } from './specialSectionCache';

const meta: SpecialSectionMeta = {
  id: 'special:recentlyClosed',
  type: 'specialSection',
  kind: 'recentlyClosed',
  enabled: true,
  order: 0,
  itemCount: 8,
};

describe('specialSectionCache', () => {
  beforeEach(() => {
    invalidateSpecialSectionCache();
    vi.mocked(loadSpecialSection).mockReset();
  });

  it('does not cache a stale in-flight result when invalidated mid-fetch', async () => {
    let resolveStale!: (vm: SpecialSectionViewModel) => void;
    const stalePromise = new Promise<SpecialSectionViewModel>((resolve) => {
      resolveStale = resolve;
    });
    const freshVm: SpecialSectionViewModel = {
      id: meta.id,
      title: 'Recently Closed',
      groups: [{ title: '', items: [{ title: 'Fresh', url: 'https://fresh.example' }] }],
    };

    vi.mocked(loadSpecialSection)
      .mockReturnValueOnce(stalePromise)
      .mockResolvedValueOnce(freshVm);

    const firstLoad = loadSpecialSectionCached(meta);
    invalidateSpecialSectionCache('recentlyClosed');

    resolveStale({
      id: meta.id,
      title: 'Recently Closed',
      groups: [{ title: '', items: [{ title: 'Stale', url: 'https://stale.example' }] }],
    });

    await firstLoad;
    const secondLoad = await loadSpecialSectionCached(meta);

    expect(secondLoad).toEqual(freshVm);
    expect(loadSpecialSection).toHaveBeenCalledTimes(2);
  });
});
