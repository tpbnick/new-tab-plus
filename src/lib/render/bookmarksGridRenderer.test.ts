import { describe, expect, it } from 'vitest';
import { bookmarkColumnSignature } from './bookmarksGridRenderer';
import type { BookmarkColumnViewModel } from '../types';

describe('bookmarkColumnSignature', () => {
  it('changes when bookmark title changes', () => {
    const linkOptions = {
      openLinksInSameTab: false,
      rememberOpenFolders: true,
    };
    const before: BookmarkColumnViewModel = {
      id: 'grid:1',
      order: 0,
      enabled: true,
      stack: [
        {
          kind: 'folder',
          folder: {
            bookmarkId: '1',
            title: 'Work',
            parentBookmarkId: '0',
            isSyntheticRoot: false,
            collapsed: false,
            children: [{ id: '2', title: 'Docs', url: 'https://example.com', collapsed: false }],
          },
        },
      ],
    };
    const folderEntry = before.stack[0]!;
    if (folderEntry.kind !== 'folder') throw new Error('expected folder');
    const after: BookmarkColumnViewModel = {
      ...before,
      stack: [
        {
          kind: 'folder',
          folder: {
            ...folderEntry.folder,
            children: [{ id: '2', title: 'Documents', url: 'https://example.com', collapsed: false }],
          },
        },
      ],
    };

    expect(bookmarkColumnSignature(before, linkOptions)).not.toBe(
      bookmarkColumnSignature(after, linkOptions)
    );
  });

  it('is stable when view model is unchanged', () => {
    const vm: BookmarkColumnViewModel = {
      id: 'grid:1',
      order: 0,
      enabled: true,
      stack: [],
    };
    const linkOptions = { openLinksInSameTab: true, rememberOpenFolders: false };
    expect(bookmarkColumnSignature(vm, linkOptions)).toBe(bookmarkColumnSignature(vm, linkOptions));
  });
});
