import { describe, expect, it } from 'vitest';
import { flattenBookmarkLinks, searchBookmarkEntries, type BookmarkSearchEntry } from './bookmarkSearchIndex';

const sampleTree = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          {
            id: '2',
            title: 'Work',
            children: [
              { id: '3', title: 'GitHub', url: 'https://github.com' },
              { id: '4', title: 'Docs', url: 'https://docs.example.com' },
            ],
          },
          { id: '5', title: 'News', url: 'https://news.example.com' },
        ],
      },
    ],
  },
] as chrome.bookmarks.BookmarkTreeNode[];

describe('flattenBookmarkLinks', () => {
  it('collects nested bookmark urls with folder paths', () => {
    const entries = flattenBookmarkLinks(sampleTree);
    expect(entries).toEqual([
      {
        id: '3',
        title: 'GitHub',
        url: 'https://github.com',
        path: 'Bookmarks Bar › Work',
      },
      {
        id: '4',
        title: 'Docs',
        url: 'https://docs.example.com',
        path: 'Bookmarks Bar › Work',
      },
      {
        id: '5',
        title: 'News',
        url: 'https://news.example.com',
        path: 'Bookmarks Bar',
      },
    ]);
  });
});

describe('searchBookmarkEntries', () => {
  const entries = flattenBookmarkLinks(sampleTree);

  it('ranks title prefix matches above substring matches', () => {
    const extra: BookmarkSearchEntry[] = [
      ...entries,
      { id: '6', title: 'My GitHub Mirror', url: 'https://mirror.example.com', path: 'Bookmarks Bar' },
    ];
    const results = searchBookmarkEntries(extra, 'git');
    expect(results[0]?.title).toBe('GitHub');
  });

  it('returns an empty list for blank queries', () => {
    expect(searchBookmarkEntries(entries, '   ')).toEqual([]);
  });
});
