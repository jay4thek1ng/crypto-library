import {
  addBookmark,
  clearReadingNow,
  emptyState,
  loadState,
  parseState,
  progressPage,
  READING_NOW_LIMIT,
  removeBookmark,
  saveState,
  setProgress,
  toggleWant,
  touchReadingNow,
} from '../src/lib/storage';
import type { Kv } from '../src/lib/storage';

function memoryKv(): Kv {
  const data = new Map<string, string>();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
    removeItem: async (key) => { data.delete(key); },
  };
}

describe('library storage', () => {
  it('keeps Reading Now unique, recent, and capped', () => {
    let state = emptyState();
    for (let i = 0; i < READING_NOW_LIMIT + 2; i++) state = touchReadingNow(state, `p${i}`);
    state = touchReadingNow(state, 'p3');
    expect(state.readingNow).toHaveLength(READING_NOW_LIMIT);
    expect(state.readingNow[0]).toBe('p3');
    expect(state.readingNow.filter((id) => id === 'p3')).toHaveLength(1);
    expect(clearReadingNow(state).readingNow).toEqual([]);
  });

  it('toggles Want to Read', () => {
    let state = emptyState();
    state = toggleWant(state, 'bitcoin');
    state = toggleWant(state, 'solana');
    expect(state.want).toEqual(['solana', 'bitcoin']);
    state = toggleWant(state, 'bitcoin');
    expect(state.want).toEqual(['solana']);
  });

  it('stores a bookmark per paper and page and resumes progress', () => {
    let state = emptyState();
    state = addBookmark(state, { paperId: 'bitcoin', page: 3, title: 'Bitcoin', createdAt: 1 });
    state = addBookmark(state, { paperId: 'bitcoin', page: 3, title: 'Bitcoin again', createdAt: 2 });
    state = addBookmark(state, { paperId: 'bitcoin', page: 9, title: 'Bitcoin', createdAt: 3 });
    expect(state.bookmarks.map((bookmark) => bookmark.page)).toEqual([9, 3]);
    expect(state.bookmarks.find((bookmark) => bookmark.page === 3)?.title).toBe('Bitcoin again');
    state = removeBookmark(state, 'bitcoin', 3);
    expect(state.bookmarks).toHaveLength(1);
    state = setProgress(state, 'bitcoin', 9, 20);
    expect(progressPage(state, 'bitcoin')).toBe(9);
    state = setProgress(state, 'bitcoin', 0, 21);
    expect(progressPage(state, 'bitcoin')).toBe(9);
    expect(addBookmark(state, { paperId: '', page: 1, title: '', createdAt: 0 })).toBe(state);
  });

  it('round-trips through storage and ignores corrupt data', async () => {
    const kv = memoryKv();
    const state = setProgress(touchReadingNow(toggleWant(emptyState(), 'bitcoin'), 'bitcoin'), 'bitcoin', 2, 5);
    await saveState(kv, state);
    const loaded = await loadState(kv);
    expect(loaded.readingNow).toEqual(['bitcoin']);
    expect(loaded.want).toEqual(['bitcoin']);
    expect(progressPage(loaded, 'bitcoin')).toBe(2);
    expect(parseState('not json').readingNow).toEqual([]);
    expect(parseState(null).bookmarks).toEqual([]);
  });

  it('persists appearance and readerTheme with light/white defaults', () => {
    expect(emptyState().appearance).toBe('light');
    expect(emptyState().readerTheme).toBe('white');
    const saved = JSON.stringify({ ...emptyState(), appearance: 'dark', readerTheme: 'sepia' });
    const parsed = parseState(saved);
    expect(parsed.appearance).toBe('dark');
    expect(parsed.readerTheme).toBe('sepia');
    const invalid = parseState(JSON.stringify({ appearance: 'neon', readerTheme: 'blue' }));
    expect(invalid.appearance).toBe('light');
    expect(invalid.readerTheme).toBe('white');
  });

});
