import type { ShelfKey, TopicKey } from '../data/shelves';
import { isTopicKey } from '../data/shelves';
import type { LibraryItem, PaperKind } from '../types';

export const LIBRARY_ORIGIN = 'https://jay4thek1ng.github.io/crypto-library/';

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

export interface RawCatalogEntry {
  id?: unknown;
  title?: unknown;
  project?: unknown;
  ticker?: unknown;
  authors?: unknown;
  year?: unknown;
  cat?: unknown;
  shelf?: unknown;
  tags?: unknown;
  summary?: unknown;
  url?: unknown;
  sourceUrl?: unknown;
  pdfUrl?: unknown;
  htmlUrl?: unknown;
  kind?: unknown;
  local?: unknown;
  localKind?: unknown;
  cover?: unknown;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function yearOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1900 || n > 2100) return null;
  return n;
}

function joinOrigin(origin: string, rel: string): string {
  return `${origin.replace(/\/+$/, '/')}${rel.replace(/^\/+/, '')}`;
}

function isDirectPdf(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url);
}

function tagsOf(value: unknown): ShelfKey[] {
  if (!Array.isArray(value)) return [];
  const tags: ShelfKey[] = [];
  for (const tag of value) {
    if (isTopicKey(tag) && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function kindFrom(entry: RawCatalogEntry, local: string, sourceUrl: string): { kind: PaperKind; pdfUrl: string | null; htmlUrl: string | null } {
  const localKind = text(entry.localKind, 20);
  const explicitPdf = text(entry.pdfUrl, 2000);
  const explicitHtml = text(entry.htmlUrl, 2000);
  if (explicitPdf && isDirectPdf(explicitPdf)) return { kind: 'pdf', pdfUrl: explicitPdf, htmlUrl: null };
  if (explicitHtml) return { kind: 'html', pdfUrl: null, htmlUrl: explicitHtml };
  if (local && (local.endsWith('.pdf') || localKind === 'pdf')) {
    return { kind: 'pdf', pdfUrl: joinOrigin(LIBRARY_ORIGIN, local), htmlUrl: null };
  }
  if (sourceUrl && isDirectPdf(sourceUrl)) return { kind: 'pdf', pdfUrl: sourceUrl, htmlUrl: null };
  if (local && (local.endsWith('.html') || local.endsWith('.htm') || localKind === 'html')) {
    return { kind: 'html', pdfUrl: null, htmlUrl: joinOrigin(LIBRARY_ORIGIN, local) };
  }
  return { kind: 'external', pdfUrl: null, htmlUrl: null };
}

export function parseCatalogEntry(entry: unknown, origin = LIBRARY_ORIGIN): LibraryItem | null {
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as RawCatalogEntry;
  const id = text(row.id, 81);
  const title = text(row.title, 500);
  const project = text(row.project, 200);
  if (!ID_RE.test(id) || !title || !project) return null;
  const shelfValue = row.shelf ?? row.cat;
  if (!isTopicKey(shelfValue)) return null;
  const sourceUrl = text(row.sourceUrl ?? row.url, 2000);
  const local = text(row.local, 500);
  // origin is accepted so tests can point at another host; the hosted library is the default.
  const resolved = kindFrom({ ...row, pdfUrl: row.pdfUrl, htmlUrl: row.htmlUrl }, local, sourceUrl);
  if (origin !== LIBRARY_ORIGIN) {
    if (resolved.pdfUrl?.startsWith(LIBRARY_ORIGIN)) resolved.pdfUrl = origin.replace(/\/+$/, '/') + resolved.pdfUrl.slice(LIBRARY_ORIGIN.length);
    if (resolved.htmlUrl?.startsWith(LIBRARY_ORIGIN)) resolved.htmlUrl = origin.replace(/\/+$/, '/') + resolved.htmlUrl.slice(LIBRARY_ORIGIN.length);
  }
  const cover = text(row.cover, 81);
  const shelf: TopicKey = shelfValue;
  return {
    id,
    title,
    project,
    ticker: text(row.ticker, 20),
    authors: text(row.authors, 500),
    year: yearOf(row.year),
    shelf,
    tags: tagsOf(row.tags).filter((tag) => tag !== shelf),
    summary: text(row.summary, 2000),
    sourceUrl,
    pdfUrl: resolved.pdfUrl,
    htmlUrl: resolved.htmlUrl,
    kind: resolved.kind,
    cover: cover || null,
    coverUri: null,
    origin: 'catalog',
    topic: null,
    size: 0,
    pages: 0,
    created: null,
    communityId: null,
  };
}

export function parseCatalog(input: unknown, origin = LIBRARY_ORIGIN): LibraryItem[] {
  if (!Array.isArray(input)) throw new Error('Catalog must be a JSON array');
  const items: LibraryItem[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    const item = parseCatalogEntry(entry, origin);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

export function onShelf(item: LibraryItem, shelf: ShelfKey): boolean {
  if (shelf === 'CM') return item.origin === 'community';
  if (shelf === 'UP') return item.origin === 'private' && item.shelf === 'UP';
  if (item.origin === 'community') return false;
  if (item.origin === 'private') return item.shelf === shelf;
  return item.shelf === shelf || item.tags.includes(shelf);
}

export function kindLabel(item: LibraryItem): string {
  if (item.origin === 'community') return 'Community';
  if (item.origin === 'private') return 'Private';
  if (item.kind === 'html') return 'Web';
  if (item.kind === 'external') return 'Docs';
  return 'Paper';
}
