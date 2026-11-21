export interface Kv {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const LIBRARY_STATE_KEY = 'cryptolib.library.v1';
export const READING_NOW_LIMIT = 12;
export const BOOKMARK_LIMIT = 200;

export interface Bookmark {
  paperId: string;
  page: number;
  title: string;
  createdAt: number;
}

export interface ProgressEntry {
  page: number;
  updatedAt: number;
}

export interface PrivatePaper {
  id: string;
  title: string;
  project: string;
  year: number | null;
  shelf: string;
  notes: string;
  fileName: string;
  size: number;
  added: number;
}

export type AppearanceMode = 'system' | 'light' | 'dark';
export type ReaderThemeMode = 'white' | 'sepia' | 'dark';

export interface LibraryState {
  readingNow: string[];
  want: string[];
  bookmarks: Bookmark[];
  progress: Record<string, ProgressEntry>;
  reported: string[];
  privatePapers: PrivatePaper[];
  deviceId: string;
  sort: 'year' | 'title' | 'project';
  appearance: AppearanceMode;
  readerTheme: ReaderThemeMode;
}

export function emptyState(): LibraryState {
  return { readingNow: [], want: [], bookmarks: [], progress: {}, reported: [], privatePapers: [], deviceId: '', sort: 'year', appearance: 'light', readerTheme: 'white' };
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !entry || out.includes(entry)) continue;
    out.push(entry);
    if (out.length >= max) break;
  }
  return out;
}

function pageOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 100000) return null;
  return n;
}

function bookmarksOf(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) return [];
  const out: Bookmark[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Partial<Bookmark>;
    const page = pageOf(row.page);
    const paperId = typeof row.paperId === 'string' ? row.paperId : '';
    if (!paperId || page == null) continue;
    const key = `${paperId}:${page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      paperId,
      page,
      title: typeof row.title === 'string' ? row.title.slice(0, 500) : '',
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0,
    });
    if (out.length >= BOOKMARK_LIMIT) break;
  }
  return out;
}

function progressOf(value: unknown): Record<string, ProgressEntry> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, ProgressEntry> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Partial<ProgressEntry>;
    const page = pageOf(row.page);
    if (page == null) continue;
    out[id] = { page, updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0 };
  }
  return out;
}

export function parseState(raw: string | null): LibraryState {
  if (!raw) return emptyState();
  try {
    const value = JSON.parse(raw) as Partial<LibraryState>;
    const sort = value.sort === 'title' || value.sort === 'project' || value.sort === 'year' ? value.sort : 'year';
    const appearance: AppearanceMode = value.appearance === 'system' || value.appearance === 'light' || value.appearance === 'dark' ? value.appearance : 'light';
    const readerTheme: ReaderThemeMode = value.readerTheme === 'white' || value.readerTheme === 'sepia' || value.readerTheme === 'dark' ? value.readerTheme : 'white';
    return {
      readingNow: stringList(value.readingNow, READING_NOW_LIMIT),
      want: stringList(value.want, 500),
      bookmarks: bookmarksOf(value.bookmarks),
      progress: progressOf(value.progress),
      reported: stringList(value.reported, 500),
      privatePapers: Array.isArray(value.privatePapers) ? value.privatePapers.filter((row) => row && typeof row.id === 'string' && typeof row.title === 'string') : [],
      deviceId: typeof value.deviceId === 'string' ? value.deviceId : '',
      sort,
      appearance,
      readerTheme,
    };
  } catch {
    return emptyState();
  }
}

export function touchReadingNow(state: LibraryState, id: string): LibraryState {
  if (!id) return state;
  return { ...state, readingNow: [id, ...state.readingNow.filter((item) => item !== id)].slice(0, READING_NOW_LIMIT) };
}

export function clearReadingNow(state: LibraryState): LibraryState {
  return { ...state, readingNow: [] };
}

export function toggleWant(state: LibraryState, id: string): LibraryState {
  if (!id) return state;
  const has = state.want.includes(id);
  return { ...state, want: has ? state.want.filter((item) => item !== id) : [id, ...state.want].slice(0, 500) };
}

export function addBookmark(state: LibraryState, bookmark: Bookmark): LibraryState {
  const page = pageOf(bookmark.page);
  if (!bookmark.paperId || page == null) return state;
  const next = bookmark.page === page ? bookmark : { ...bookmark, page };
  const without = state.bookmarks.filter((item) => item.paperId !== next.paperId || item.page !== next.page);
  return { ...state, bookmarks: [next, ...without].slice(0, BOOKMARK_LIMIT) };
}

export function removeBookmark(state: LibraryState, paperId: string, page: number): LibraryState {
  return { ...state, bookmarks: state.bookmarks.filter((item) => item.paperId !== paperId || item.page !== page) };
}

export function hasBookmark(state: LibraryState, paperId: string, page: number): boolean {
  return state.bookmarks.some((item) => item.paperId === paperId && item.page === page);
}

export function setProgress(state: LibraryState, paperId: string, page: number, updatedAt: number): LibraryState {
  const safe = pageOf(page);
  if (!paperId || safe == null) return state;
  return { ...state, progress: { ...state.progress, [paperId]: { page: safe, updatedAt } } };
}

export function progressPage(state: LibraryState, paperId: string): number | null {
  return state.progress[paperId]?.page ?? null;
}

export function markReported(state: LibraryState, communityId: string): LibraryState {
  if (!communityId || state.reported.includes(communityId)) return state;
  return { ...state, reported: [...state.reported, communityId].slice(-500) };
}

export async function loadState(kv: Kv): Promise<LibraryState> {
  return parseState(await kv.getItem(LIBRARY_STATE_KEY));
}

export async function saveState(kv: Kv, state: LibraryState): Promise<void> {
  await kv.setItem(LIBRARY_STATE_KEY, JSON.stringify(state));
}
