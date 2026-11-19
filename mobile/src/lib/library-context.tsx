import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isShelfKey, isTopicKey } from '../data/shelves';
import type { LibraryItem } from '../types';
import { asyncKv } from './async-kv';
import { CATALOG } from './catalog-data';
import { parseCommunityRows, stripCommunityCovers } from './community';
import { COMMUNITY_CACHE_KEY, SUPABASE_URL } from './config';
import { isValidDeviceId, newDeviceId } from './device';
import { clearDownloadedFiles, measureDownloads } from './files';
import { paperFileName } from './offline-cache';
import type { CacheRecord } from './offline-cache';
import {
  addBookmark,
  clearReadingNow,
  emptyState,
  hasBookmark,
  loadState,
  markReported,
  progressPage,
  removeBookmark,
  saveState,
  setProgress,
  toggleWant,
  touchReadingNow,
} from './storage';
import type { LibraryState, PrivatePaper } from './storage';

export type CommunityStatus = 'loading' | 'online' | 'offline' | 'error';

interface LibraryContextValue {
  ready: boolean;
  items: LibraryItem[];
  state: LibraryState;
  communityStatus: CommunityStatus;
  communityMessage: string;
  cache: CacheRecord[];
  storageBytes: number;
  find: (id: string) => LibraryItem | undefined;
  refreshCommunity: () => Promise<void>;
  touchReading: (id: string) => void;
  clearReading: () => void;
  toggleWant: (id: string) => void;
  isWanted: (id: string) => boolean;
  addBookmark: (paperId: string, page: number, title: string) => void;
  removeBookmark: (paperId: string, page: number) => void;
  isBookmarked: (paperId: string, page: number) => boolean;
  progressPage: (id: string) => number | null;
  setProgress: (id: string, page: number) => void;
  isReported: (communityId: string) => boolean;
  markReported: (communityId: string) => void;
  noteCached: (id: string, bytes: number, extension?: string) => void;
  clearDownloads: () => Promise<void>;
  addPrivate: (paper: PrivatePaper) => void;
  deviceId: string;
}

const Ctx = createContext<LibraryContextValue | null>(null);

function privateToItem(paper: PrivatePaper): LibraryItem {
  const shelf = isShelfKey(paper.shelf) ? paper.shelf : 'UP';
  return {
    id: paper.id,
    title: paper.title,
    project: paper.project,
    ticker: '',
    authors: '',
    year: paper.year,
    shelf,
    tags: [],
    summary: paper.notes,
    sourceUrl: '',
    pdfUrl: null,
    htmlUrl: null,
    kind: 'pdf',
    cover: null,
    coverUri: null,
    origin: 'private',
    topic: isTopicKey(shelf) ? shelf : null,
    size: paper.size,
    pages: 0,
    created: new Date(paper.added).toISOString(),
    communityId: null,
  };
}

async function readCommunityCache(): Promise<unknown[] | null> {
  try {
    const raw = await AsyncStorage.getItem(COMMUNITY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rows?: unknown };
    return Array.isArray(parsed.rows) ? parsed.rows : null;
  } catch {
    return null;
  }
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(emptyState);
  const [ready, setReady] = useState(false);
  const [community, setCommunity] = useState<LibraryItem[]>([]);
  const communityRef = useRef<LibraryItem[]>([]);
  const [communityStatus, setCommunityStatus] = useState<CommunityStatus>('loading');
  const [communityMessage, setCommunityMessage] = useState('Loading community uploads…');
  const [cache, setCache] = useState<CacheRecord[]>([]);

  const replaceCommunity = useCallback((next: LibraryItem[]) => {
    communityRef.current = next;
    setCommunity(next);
  }, []);

  const commit = useCallback((recipe: (prev: LibraryState) => LibraryState) => {
    setState((prev) => {
      const next = recipe(prev);
      void saveState(asyncKv, next);
      return next;
    });
  }, []);

  const refreshCommunity = useCallback(async () => {
    try {
      const { listCommunityPapers } = await import('./supabase');
      const rows = await listCommunityPapers();
      replaceCommunity(parseCommunityRows(rows, SUPABASE_URL));
      setCommunityStatus('online');
      setCommunityMessage('Shared by app users and public to everyone.');
      await AsyncStorage.setItem(COMMUNITY_CACHE_KEY, JSON.stringify({ at: Date.now(), rows: stripCommunityCovers(rows) }));
    } catch (error) {
      const network = error instanceof Error && (error.message === 'NETWORK' || error.message.includes('Network'));
      setCommunityStatus(communityRef.current.length ? 'offline' : 'error');
      setCommunityMessage(
        network
          ? 'Offline · connect to the internet to see community uploads'
          : "Couldn't load community uploads",
      );
    }
  }, [replaceCommunity]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const loaded = await loadState(asyncKv);
      const withDevice = isValidDeviceId(loaded.deviceId) ? loaded : { ...loaded, deviceId: newDeviceId() };
      if (withDevice !== loaded) await saveState(asyncKv, withDevice);
      if (cancel) return;
      setState(withDevice);
      const cachedRows = await readCommunityCache();
      if (!cancel && cachedRows) {
        replaceCommunity(parseCommunityRows(cachedRows, SUPABASE_URL));
        setCommunityStatus('offline');
        setCommunityMessage('Offline · connect to the internet to see community uploads');
      }
      const records = await measureDownloads().catch(() => []);
      if (!cancel) setCache(records);
      if (!cancel) setReady(true);
      if (!cancel) await refreshCommunity();
    })();
    return () => {
      cancel = true;
    };
  }, [refreshCommunity, replaceCommunity]);

  const items = useMemo(
    () => [...CATALOG, ...community, ...state.privatePapers.map(privateToItem)],
    [community, state.privatePapers],
  );

  const find = useCallback((id: string) => items.find((item) => item.id === id), [items]);
  const storageBytes = useMemo(() => cache.reduce((sum, record) => sum + record.bytes, 0), [cache]);

  const value = useMemo<LibraryContextValue>(() => ({
    ready,
    items,
    state,
    communityStatus,
    communityMessage,
    cache,
    storageBytes,
    find,
    refreshCommunity,
    touchReading: (id) => commit((prev) => touchReadingNow(prev, id)),
    clearReading: () => commit(clearReadingNow),
    toggleWant: (id) => commit((prev) => toggleWant(prev, id)),
    isWanted: (id) => state.want.includes(id),
    addBookmark: (paperId, page, title) => commit((prev) => addBookmark(prev, { paperId, page, title, createdAt: Date.now() })),
    removeBookmark: (paperId, page) => commit((prev) => removeBookmark(prev, paperId, page)),
    isBookmarked: (paperId, page) => hasBookmark(state, paperId, page),
    progressPage: (id) => progressPage(state, id),
    setProgress: (id, page) => commit((prev) => setProgress(prev, id, page, Date.now())),
    isReported: (communityId) => state.reported.includes(communityId),
    markReported: (communityId) => commit((prev) => markReported(prev, communityId)),
    noteCached: (id, bytes, extension = 'pdf') => {
      setCache((prev) => {
        const fileName = paperFileName(id, extension);
        const next = prev.filter((record) => record.id !== id);
        next.push({ id, bytes, fileName });
        return next;
      });
    },
    clearDownloads: async () => {
      await clearDownloadedFiles();
      setCache([]);
    },
    addPrivate: (paper) => commit((prev) => ({ ...prev, privatePapers: [...prev.privatePapers.filter((item) => item.id !== paper.id), paper] })),
    deviceId: state.deviceId,
  }), [ready, items, state, communityStatus, communityMessage, cache, storageBytes, find, refreshCommunity, commit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useLibrary must be used inside LibraryProvider');
  return value;
}
