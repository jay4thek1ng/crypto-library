import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { PdfFrame } from '../../src/components/PdfFrame';
import type { PdfFrameHandle } from '../../src/components/pdf-frame';
import { useLibrary } from '../../src/lib/library-context';
import { ensureDownloaded, privateFileUri } from '../../src/lib/files';
import { buildReaderUrl } from '../../src/lib/offline-cache';
import { prepareReaderBase, readerReadAccessUrl } from '../../src/lib/reader-bundle';
import { theme } from '../../src/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

interface ReaderMessage {
  type?: string;
  page?: number;
  pages?: number;
  zoom?: number;
  message?: string;
}

export default function ReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; page?: string }>();
  const id = param(params.id);
  const pageParam = param(params.page);
  const library = useLibrary();
  const item = library.find(id);
  const frame = useRef<PdfFrameHandle>(null);
  const libraryRef = useRef(library);
  useEffect(() => {
    libraryRef.current = library;
  });
  const [uri, setUri] = useState<string | null>(null);
  const [html, setHtml] = useState(false);
  const [status, setStatus] = useState('Opening…');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [pageText, setPageText] = useState('1');
  const [zoom, setZoom] = useState(1);
  const editing = useRef(false);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const current = libraryRef.current;
    const paper = current.find(id);
    if (!paper) return;
    let cancel = false;
    current.touchReading(paper.id);
    void (async () => {
      const requested = Number.parseInt(pageParam, 10);
      const resume = Number.isInteger(requested) && requested > 0 ? requested : current.progressPage(paper.id) ?? 1;
      setPage(resume);
      setPageText(String(resume));
      try {
        if (paper.kind === 'external' && !paper.pdfUrl) {
          setError('This paper has no direct PDF. Open the official page instead.');
          setStatus('');
          return;
        }
        let fileUri: string | null = null;
        if (paper.origin === 'private') {
          fileUri = await privateFileUri(paper.id);
          if (!fileUri) throw new Error('The private copy of this PDF is missing on this device.');
        } else if (paper.kind === 'html' && paper.htmlUrl) {
          try {
            const saved = await ensureDownloaded(paper.id, paper.htmlUrl, 'html');
            fileUri = saved.uri;
            current.noteCached(paper.id, saved.bytes, 'html');
          } catch {
            fileUri = paper.htmlUrl;
          }
          if (cancel) return;
          setHtml(true);
          setUri(fileUri);
          setStatus('');
          return;
        } else if (paper.pdfUrl) {
          try {
            setStatus('Saving for offline…');
            const saved = await ensureDownloaded(paper.id, paper.pdfUrl, 'pdf');
            fileUri = saved.uri;
            current.noteCached(paper.id, saved.bytes, 'pdf');
            setStatus('Opening…');
          } catch {
            fileUri = paper.pdfUrl;
          }
        }
        if (!fileUri) throw new Error('No file is available for this paper.');
        const base = await prepareReaderBase();
        if (cancel) return;
        setUri(buildReaderUrl(base, fileUri, resume));
        setStatus('');
      } catch (openError) {
        if (!cancel) {
          setError(openError instanceof Error ? openError.message : 'Could not open this paper.');
          setStatus('');
        }
      }
    })();
    return () => {
      cancel = true;
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [id, item?.id, item?.pdfUrl, item?.htmlUrl, item?.origin, pageParam]);

  function onMessage(data: string) {
    let message: ReaderMessage;
    try {
      message = JSON.parse(data) as ReaderMessage;
    } catch {
      return;
    }
    if (message.type === 'ready' && message.pages) setPages(message.pages);
    if (message.type === 'page' && message.page) {
      setPage(message.page);
      if (!editing.current) setPageText(String(message.page));
      if (progressTimer.current) clearTimeout(progressTimer.current);
      const next = message.page;
      progressTimer.current = setTimeout(() => libraryRef.current.setProgress(id, next), 350);
    }
    if (message.type === 'zoom' && typeof message.zoom === 'number') setZoom(message.zoom);
    if (message.type === 'error') setError(message.message || 'Could not open this PDF.');
  }

  function jump() {
    const next = Number.parseInt(pageText, 10);
    if (Number.isInteger(next) && next > 0) frame.current?.setPage(next);
  }

  function changeZoom(factor: number) {
    const next = Math.min(3.5, Math.max(0.6, Math.round(zoom * factor * 100) / 100));
    setZoom(next);
    frame.current?.setZoom(next);
  }

  const bookmarked = item ? library.isBookmarked(item.id, page) : false;
  const missing = !item && library.ready && !(id.startsWith('c-') && library.communityStatus === 'loading');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.chrome}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹ Library</Text></Pressable>
        <Text style={styles.title} numberOfLines={1}>{item?.title ?? 'Paper'}</Text>
      </View>
        {!html && uri ? (
          <View style={styles.tools}>
            <TextInput
              value={pageText}
              onChangeText={setPageText}
              onFocus={() => { editing.current = true; }}
              onBlur={() => { editing.current = false; jump(); }}
              onSubmitEditing={jump}
              keyboardType="number-pad"
              style={styles.pageInput}
              accessibilityLabel="Page number"
            />
            <Text style={styles.pages}>{pages ? `/ ${pages}` : ''}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => changeZoom(1 / 1.25)} style={styles.zoom}><Text style={styles.zoomText}>−</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Reset zoom to fit width" onPress={() => { setZoom(1); frame.current?.setZoom(1); }}><Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => changeZoom(1.25)} style={styles.zoom}><Text style={styles.zoomText}>+</Text></Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fit width"
              onPress={() => { setZoom(1); frame.current?.setZoom(1); }}
              style={[styles.fitBtn, Math.round(zoom * 100) !== 100 && styles.fitBtnActive]}
            >
              <Text style={[styles.fitText, Math.round(zoom * 100) !== 100 && styles.fitTextActive]}>Fit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark page'}
              style={styles.bookmarkBtn}
              onPress={() => {
                if (!item) return;
                if (bookmarked) library.removeBookmark(item.id, page);
                else library.addBookmark(item.id, page, item.title);
              }}
            >
              <Text style={styles.bookmark}>{bookmarked ? 'Bookmarked' : 'Bookmark'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {missing ? <View style={styles.center}><Text style={styles.error}>This paper is not in the library.</Text></View> : null}
      {status && !missing ? (
        <View style={styles.center}><ActivityIndicator color={theme.accent2} /><Text style={styles.status}>{status}</Text></View>
      ) : null}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          {item?.sourceUrl ? <Text style={styles.back} onPress={() => void Linking.openURL(item.sourceUrl)}>Open official page</Text> : null}
        </View>
      ) : null}
      {uri ? <PdfFrame ref={frame} uri={uri} onMessage={onMessage} readAccessUrl={readerReadAccessUrl()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  chrome: { backgroundColor: theme.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingTop: 8 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 4 },
  back: { color: theme.accent2, fontSize: 16, paddingVertical: 6 },
  title: { flex: 1, color: theme.text, fontWeight: '600', fontSize: 15 },
  pageInput: { width: 40, color: theme.text, backgroundColor: theme.fill, borderRadius: 8, textAlign: 'center', paddingVertical: 4, fontSize: 14 },
  pages: { color: theme.text3, fontSize: 13, marginRight: 2 },
  zoom: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.fill, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: theme.text, fontSize: 18, lineHeight: 20 },
  zoomLabel: { color: theme.accent2, fontSize: 13, minWidth: 38, textAlign: 'center' },
  fitBtn: { height: 30, paddingHorizontal: 8, borderRadius: 8, backgroundColor: theme.fill, alignItems: 'center', justifyContent: 'center' },
  fitBtnActive: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.accent2 },
  fitText: { color: theme.text3, fontSize: 12, fontWeight: '600' },
  fitTextActive: { color: theme.accent2 },
  bookmarkBtn: { marginLeft: 'auto' },
  bookmark: { color: theme.accent, fontSize: 14, fontWeight: '700', paddingHorizontal: 4 },
  center: { padding: 24, alignItems: 'center', gap: 10 },
  status: { color: theme.text2 },
  error: { color: theme.text, textAlign: 'center', lineHeight: 21 },
});
