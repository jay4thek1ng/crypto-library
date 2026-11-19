import {
  buildReaderUrl,
  findCacheRecord,
  formatBytes,
  idFromPaperFileName,
  isSafePaperFileName,
  paperFileName,
  removeCacheRecord,
  resolvePdfSource,
  totalCacheBytes,
  upsertCacheRecord,
} from '../src/lib/offline-cache';

describe('offline cache helpers', () => {
  it('builds safe file names that cannot escape the papers directory', () => {
    expect(paperFileName('bitcoin')).toBe('bitcoin.pdf');
    expect(paperFileName('c-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'html')).toBe('c-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.html');
    expect(paperFileName('../../etc/passwd')).not.toContain('/');
    expect(paperFileName('../../etc/passwd')).toBe('etc_passwd.pdf');
    expect(isSafePaperFileName('bitcoin.pdf')).toBe(true);
    expect(isSafePaperFileName('../bitcoin.pdf')).toBe(false);
    expect(idFromPaperFileName('ethereum-white.html')).toBe('ethereum-white');
    expect(idFromPaperFileName('../nope.pdf')).toBeNull();
  });

  it('prefers a saved file over the remote URL', () => {
    expect(resolvePdfSource('file:///papers/bitcoin.pdf', 'https://jay4thek1ng.github.io/crypto-library/library/layer-1s/bitcoin.pdf')).toBe('file:///papers/bitcoin.pdf');
    expect(resolvePdfSource(null, 'https://example.com/paper.pdf')).toBe('https://example.com/paper.pdf');
    expect(resolvePdfSource(undefined, null)).toBeNull();
  });

  it('sums storage and formats it', () => {
    const records = upsertCacheRecord([], { id: 'bitcoin', bytes: 180000, fileName: 'bitcoin.pdf' });
    const again = upsertCacheRecord(records, { id: 'bitcoin', bytes: 200000, fileName: 'bitcoin.pdf' });
    expect(again).toHaveLength(1);
    expect(findCacheRecord(again, 'bitcoin')?.bytes).toBe(200000);
    expect(totalCacheBytes(again)).toBe(200000);
    expect(removeCacheRecord(again, 'bitcoin')).toEqual([]);
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(1536)).toBe('2 KB');
    expect(formatBytes(2.5 * 1048576)).toBe('2.5 MB');
  });

  it('builds a reader URL that resumes on a page', () => {
    expect(buildReaderUrl('/reader/index.html', 'https://example.com/a b.pdf', 4)).toBe(
      '/reader/index.html?file=https%3A%2F%2Fexample.com%2Fa%20b.pdf&page=4',
    );
    expect(buildReaderUrl('file:///reader/index.html?x=1', 'file:///papers/bitcoin.pdf', 0)).toContain('&page=1');
  });
});
