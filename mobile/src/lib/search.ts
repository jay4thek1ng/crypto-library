import type { ShelfKey } from '../data/shelves';
import { onShelf } from './catalog';
import type { LibraryItem, SortKey } from '../types';

export function titleKey(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, '').toLowerCase();
}

/** Substring search across title, project, author, and ticker. */
export function searchPapers(items: readonly LibraryItem[], query: string): LibraryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice();
  return items.filter((item) => {
    const hay = `${item.title} ${item.project} ${item.authors} ${item.ticker}`.toLowerCase();
    return hay.includes(q);
  });
}

export function sortPapers(items: readonly LibraryItem[], sort: SortKey): LibraryItem[] {
  const next = items.slice();
  if (sort === 'title') {
    next.sort((a, b) => titleKey(a.title).localeCompare(titleKey(b.title)) || a.title.localeCompare(b.title));
  } else if (sort === 'project') {
    next.sort((a, b) => a.project.localeCompare(b.project) || (a.year ?? 9999) - (b.year ?? 9999) || titleKey(a.title).localeCompare(titleKey(b.title)));
  } else {
    next.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || titleKey(a.title).localeCompare(titleKey(b.title)));
  }
  return next;
}

export function papersOnShelf(items: readonly LibraryItem[], shelf: ShelfKey, sort: SortKey): LibraryItem[] {
  const on = items.filter((item) => onShelf(item, shelf));
  if (shelf === 'CM' && sort === 'year') {
    return on.slice().sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '') || titleKey(a.title).localeCompare(titleKey(b.title)));
  }
  return sortPapers(on, sort);
}
