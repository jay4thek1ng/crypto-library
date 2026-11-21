import type { ShelfKey, TopicKey } from '../data/shelves';
import { isTopicKey } from '../data/shelves';
import type { LibraryItem } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE = /^[0-9a-f-]{36}\.pdf$/i;
const COVER_RE = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const COVER_MAX = 150000;

export const COMMUNITY_COLUMNS = 'id,title,project,year,shelf,description,storage_path,size_bytes,cover,page_count,created_at';

export interface CommunityRow {
  id?: unknown;
  title?: unknown;
  project?: unknown;
  year?: unknown;
  shelf?: unknown;
  description?: unknown;
  storage_path?: unknown;
  size_bytes?: unknown;
  cover?: unknown;
  page_count?: unknown;
  created_at?: unknown;
}

export function communityPdfUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/papers/${storagePath}`;
}

export function parseCommunityRow(row: unknown, supabaseUrl: string): LibraryItem | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as CommunityRow;
  const id = typeof record.id === 'string' ? record.id : '';
  const storagePath = typeof record.storage_path === 'string' ? record.storage_path : '';
  if (!UUID_RE.test(id) || !PATH_RE.test(storagePath)) return null;
  const topic: TopicKey | null = isTopicKey(record.shelf) ? record.shelf : null;
  const cover = typeof record.cover === 'string' && record.cover.length <= COVER_MAX && COVER_RE.test(record.cover) ? record.cover : null;
  const year = typeof record.year === 'number' && Number.isInteger(record.year) && record.year >= 1900 && record.year <= 2100 ? record.year : null;
  const size = typeof record.size_bytes === 'number' && record.size_bytes > 0 ? record.size_bytes : 0;
  const pages = typeof record.page_count === 'number' && record.page_count > 0 ? record.page_count : 0;
  const shelf: ShelfKey = 'CM';
  return {
    id: `c-${id}`,
    title: String(record.title || 'Untitled').slice(0, 200),
    project: String(record.project || '').slice(0, 100),
    ticker: '',
    authors: '',
    year,
    shelf,
    tags: [],
    summary: record.description ? String(record.description).slice(0, 1000) : '',
    sourceUrl: '',
    pdfUrl: communityPdfUrl(supabaseUrl, storagePath),
    htmlUrl: null,
    kind: 'pdf',
    cover: null,
    coverUri: cover,
    origin: 'community',
    topic,
    size,
    pages,
    created: typeof record.created_at === 'string' ? record.created_at : null,
    communityId: id,
  };
}

export function parseCommunityRows(rows: unknown, supabaseUrl: string): LibraryItem[] {
  if (!Array.isArray(rows)) return [];
  const items: LibraryItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const item = parseCommunityRow(row, supabaseUrl);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

/** Drop inline cover images before storing the community list. AsyncStorage cannot hold hundreds of thumbnails. */
export function stripCommunityCovers(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const copy = { ...(row as Record<string, unknown>) };
    delete copy.cover;
    return copy;
  });
}

export const COMMUNITY_LOADING_MESSAGE = 'Loading community uploads…';
export const COMMUNITY_ONLINE_MESSAGE = 'Shared by app users and public to everyone.';
export const COMMUNITY_OFFLINE_MESSAGE = 'Offline · connect to the internet to see community uploads';
export const COMMUNITY_ERROR_MESSAGE = 'Community library unreachable · tap to retry';

export function resolveCommunityFailure(
  error: unknown,
  deviceOffline: boolean,
): { status: 'offline' | 'error'; message: string } {
  const status = error && typeof error === 'object' && 'status' in error && typeof (error as { status: unknown }).status === 'number'
    ? (error as { status: number }).status
    : 0;
  // An HTTP status means the server responded, so the device is online even if NetInfo disagrees.
  if (status === 0 && deviceOffline) {
    return { status: 'offline', message: COMMUNITY_OFFLINE_MESSAGE };
  }
  return { status: 'error', message: COMMUNITY_ERROR_MESSAGE };
}
