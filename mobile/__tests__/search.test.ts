import { CATALOG } from '../src/lib/catalog-data';
import { papersOnShelf, searchPapers, sortPapers } from '../src/lib/search';
import type { LibraryItem } from '../src/types';

function paper(partial: Partial<LibraryItem> & Pick<LibraryItem, 'id' | 'title' | 'project'>): LibraryItem {
  return {
    ticker: '',
    authors: '',
    year: null,
    shelf: 'L1',
    tags: [],
    summary: 'secret summary phrase',
    sourceUrl: '',
    pdfUrl: null,
    htmlUrl: null,
    kind: 'pdf',
    cover: null,
    coverUri: null,
    origin: 'catalog',
    topic: null,
    size: 0,
    pages: 0,
    created: null,
    communityId: null,
    ...partial,
  };
}

describe('searchPapers', () => {
  const sample = [
    paper({ id: 'btc', title: 'Bitcoin: A Peer-to-Peer Electronic Cash System', project: 'Bitcoin', ticker: 'BTC', authors: 'Satoshi Nakamoto', year: 2008 }),
    paper({ id: 'sol', title: 'Solana: A New Architecture', project: 'Solana', ticker: 'SOL', authors: 'Anatoly Yakovenko', year: 2017, shelf: 'L1', tags: ['SOL'] }),
  ];

  it('matches title, project, and author without matching the summary alone', () => {
    expect(searchPapers(sample, 'peer-to-peer').map((item) => item.id)).toEqual(['btc']);
    expect(searchPapers(sample, 'solana').map((item) => item.id)).toEqual(['sol']);
    expect(searchPapers(sample, 'yakovenko').map((item) => item.id)).toEqual(['sol']);
    expect(searchPapers(sample, 'NAKAMOTO').map((item) => item.id)).toEqual(['btc']);
    expect(searchPapers(sample, 'secret summary phrase')).toEqual([]);
    expect(searchPapers(sample, '   ')).toHaveLength(2);
  });

  it('matches a ticker', () => {
    expect(searchPapers(sample, 'btc').map((item) => item.id)).toEqual(['btc']);
  });

  it('finds Satoshi in the real catalog and sorts newest first', () => {
    const found = searchPapers(CATALOG, 'satoshi nakamoto');
    expect(found.some((item) => item.id === 'bitcoin')).toBe(true);
    const sorted = sortPapers(found, 'year');
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1]?.year ?? 0).toBeGreaterThanOrEqual(sorted[i]?.year ?? 0);
    }
  });

  it('keeps tagged papers on their extra shelf', () => {
    const onSolana = papersOnShelf(sample, 'SOL', 'title');
    expect(onSolana.map((item) => item.id)).toEqual(['sol']);
    expect(papersOnShelf(sample, 'CM', 'year')).toEqual([]);
  });
});
