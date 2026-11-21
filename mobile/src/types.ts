import type { ShelfKey } from './data/shelves';

export type PaperKind = 'pdf' | 'html' | 'external';
export type PaperOrigin = 'catalog' | 'community' | 'private';

export interface LibraryItem {
  id: string;
  title: string;
  project: string;
  ticker: string;
  authors: string;
  year: number | null;
  shelf: ShelfKey;
  tags: ShelfKey[];
  summary: string;
  sourceUrl: string;
  pdfUrl: string | null;
  htmlUrl: string | null;
  kind: PaperKind;
  /** Catalog cover id. Matches a key in the generated COVERS map. */
  cover: string | null;
  /** Data-URL or file thumbnail for community and private papers. */
  coverUri: string | null;
  origin: PaperOrigin;
  topic: ShelfKey | null;
  size: number;
  pages: number;
  created: string | null;
  /** Supabase row id for a community paper. Report uses this, not the c- prefixed id. */
  communityId: string | null;
}

export type SortKey = 'year' | 'title' | 'project';
