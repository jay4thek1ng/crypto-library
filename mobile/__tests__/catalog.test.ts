import fs from 'fs';
import path from 'path';
import catalogJson from '../src/data/catalog.json';
import backend from '../src/data/backend.json';
import { SHELF_ORDER } from '../src/data/shelves';
import { parseCatalog, yearOf } from '../src/lib/catalog';

const items = parseCatalog(catalogJson);

describe('parseCatalog', () => {
  it('loads every paper from the web library', () => {
    expect(items).toHaveLength(88);
    expect(new Set(items.map((item) => item.id)).size).toBe(88);
  });

  it('points bundled PDFs at the hosted library and keeps the official source', () => {
    const bitcoin = items.find((item) => item.id === 'bitcoin');
    expect(bitcoin?.pdfUrl).toBe('https://jay4thek1ng.github.io/crypto-library/library/layer-1s/bitcoin.pdf');
    expect(bitcoin?.sourceUrl).toBe('https://bitcoin.org/bitcoin.pdf');
    expect(bitcoin?.year).toBe(2008);
    expect(bitcoin?.authors).toContain('Satoshi');
    expect(bitcoin?.shelf).toBe('L1');
    expect(bitcoin?.cover).toBe('bitcoin');
    expect(bitcoin?.kind).toBe('pdf');
  });

  it('keeps HTML documents, hosted PDFs, and pages without a direct file', () => {
    const white = items.find((item) => item.id === 'ethereum-white');
    expect(white?.kind).toBe('html');
    expect(white?.htmlUrl).toContain('library/docs/ethereum-white.html');
    expect(white?.pdfUrl).toBeNull();
    const helium = items.find((item) => item.id === 'helium');
    expect(helium?.kind).toBe('pdf');
    expect(helium?.pdfUrl).toContain('library/ai-depin/helium.pdf');
    const cardano = items.find((item) => item.id === 'ouroboros');
    expect(cardano?.kind).toBe('external');
    expect(cardano?.pdfUrl).toBeNull();
    expect(cardano?.sourceUrl).toContain('eprint.iacr.org');
  });

  it('turns year 0 into undated, keeps extra shelf tags, and drops invalid rows', () => {
    expect(yearOf(0)).toBeNull();
    expect(yearOf(2008)).toBe(2008);
    const parsed = parseCatalog([
      { id: 'ok-paper', title: 'A paper', project: 'Example', year: 0, cat: 'L1', url: 'https://example.com', local: '', tags: ['NOPE', 'SOL', 'L1'] },
      { id: 'ok-paper', title: 'Duplicate', project: 'Example', cat: 'L1' },
      { id: '../etc/passwd', title: 'Bad', project: 'Example', cat: 'L1' },
      { title: 'Missing id', project: 'Example', cat: 'L1' },
      null,
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.year).toBeNull();
    expect(parsed[0]?.tags).toEqual(['SOL']);
    expect(parsed[0]?.kind).toBe('external');
  });

  it('places at least one paper on every topic shelf', () => {
    for (const shelf of SHELF_ORDER) {
      if (shelf.key === 'CM' || shelf.key === 'UP') continue;
      expect(items.some((item) => item.shelf === shelf.key || item.tags.includes(shelf.key))).toBe(true);
    }
  });

  it('bundles a cover image for every catalog cover', () => {
    const covered = items.filter((item) => item.cover);
    expect(covered.length).toBeGreaterThan(80);
    for (const item of covered) {
      expect(fs.existsSync(path.join(__dirname, '..', 'assets', 'covers', `${item.cover}.webp`))).toBe(true);
    }
  });

  it('embeds only the public Supabase anon key', () => {
    const part = backend.supabaseAnonKey.split('.')[1] ?? '';
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { role?: string };
    expect(payload.role).toBe('anon');
    expect(backend.supabaseUrl).toMatch(/^https:\/\//);
    expect(backend.supabaseAnonKey.toLowerCase()).not.toContain('service_role');
  });
});
