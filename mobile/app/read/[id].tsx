import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { PdfFrame } from '../../src/components/PdfFrame';
import type { PdfFrameHandle } from '../../src/components/pdf-frame';
import { useLibrary } from '../../src/lib/library-context';
import { ensureDownloaded, privateFileUri } from '../../src/lib/files';
import { buildReaderUrl } from '../../src/lib/offline-cache';
import { prepareReaderBase, readerReadAccessUrl } from '../../src/lib/reader-bundle';
import type { ReaderThemeMode } from '../../src/lib/storage';
import { READER_THEMES, useTheme } from '../../src/theme';

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

const READER_THEME_OPTIONS: ReaderThemeMode[] = ['white', 'sepia', 'dark'];

export default function ReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; page?: string }>();
  const id = param(params.id);
  const pageParam = param(params.page);
  const library = useLibrary();
  const appColors = useTheme();
  const readerColors = READER_THEMES[library.readerTheme];
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
  const [pageSelection, setPageSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const editing = useRef(false);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(readerColors.canvas);
    return () => {
      void SystemUI.setBackgroundColorAsync(appColors.bg);
    };
  }, [readerColors.canvas, appColors.bg]);

  useEffect(() => {
    frame.current?.setTheme(library.readerTheme);
  }, [library.readerTheme]);

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
        setUri(buildReaderUrl(base, fileUri, resume, current.readerTheme));
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
    else setPageText(String(page));
  }

  function changeZoom(factor: number) {
    const next = Math.min(3.5, Math.max(0.6, Math.round(zoom * factor * 100) / 100));
    setZoom(next);
    frame.current?.setZoom(next);
  }

  const bookmarked = item ? library.isBookmarked(item.id, page) : false;
  const missing = !item && library.ready && !(id.startsWith('c-') && library.communityStatus === 'loading');
  const isZoomed = Math.round(zoom * 100) !== 100;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: readerColors.canvas }]}>
      <StatusBar style={readerColors.barStyle} />
      <NavigationBar style={readerColors.barStyle} />
      <View style={[styles.chrome, { backgroundColor: readerColors.chromeBg, borderBottomColor: readerColors.chromeBorder }]}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={[styles.back, { color: readerColors.accent }]}>‹ Library</Text>
          </Pressable>
          <Text style={[styles.title, { color: readerColors.text }]} numberOfLines={1}>{item?.title ?? 'Paper'}</Text>
        </View>
        {!html && uri ? (
          <>
            <View style={styles.tools}>
              <TextInput
                value={pageText}
                onChangeText={(next) => {
                  setPageSelection(undefined);
                  setPageText(next);
                }}
                selection={pageSelection}
                selectTextOnFocus
                onFocus={() => {
                  editing.current = true;
                  setPageSelection({ start: 0, end: pageText.length });
                }}
                onBlur={() => {
                  editing.current = false;
                  setPageSelection(undefined);
                  jump();
                }}
                onSubmitEditing={() => {
                  setPageSelection(undefined);
                  jump();
                }}
                keyboardType="number-pad"
                keyboardAppearance={readerColors.barStyle === 'light' ? 'dark' : 'light'}
                selectionColor={readerColors.accent}
                style={[
                  styles.pageInput,
                  {
                    color: readerColors.text,
                    backgroundColor: readerColors.pillBg,
                    borderColor: readerColors.pillBorder,
                  },
                ]}
                accessibilityLabel="Page number"
              />
              <Text style={[styles.pages, { color: readerColors.text2 }]}>{pages ? `/ ${pages}` : ''}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                onPress={() => changeZoom(1 / 1.25)}
                style={[styles.zoom, { backgroundColor: readerColors.pillBg, borderColor: readerColors.pillBorder }]}
              >
                <Text style={[styles.zoomText, { color: readerColors.text }]}>−</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                onPress={() => changeZoom(1.25)}
                style={[styles.zoom, { backgroundColor: readerColors.pillBg, borderColor: readerColors.pillBorder }]}
              >
                <Text style={[styles.zoomText, { color: readerColors.text }]}>+</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fit width"
                onPress={() => { setZoom(1); frame.current?.setZoom(1); }}
                style={[
                  styles.fitBtn,
                  {
                    backgroundColor: isZoomed ? readerColors.activeFill : readerColors.pillBg,
                    borderColor: isZoomed ? readerColors.activeFill : readerColors.pillBorder,
                  },
                ]}
              >
                <Text style={[styles.fitText, { color: isZoomed ? readerColors.activeText : readerColors.text }]}>Fit</Text>
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
                <Text style={[styles.bookmark, { color: readerColors.bookmark }]}>{bookmarked ? 'Bookmarked' : 'Bookmark'}</Text>
              </Pressable>
            </View>
            <View style={styles.themeRow}>
              <Text style={[styles.themeLabel, { color: readerColors.text2 }]}>Page</Text>
              {READER_THEME_OPTIONS.map((option) => {
                const selected = library.readerTheme === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityLabel={`Reader theme ${READER_THEMES[option].label}`}
                    onPress={() => library.setReaderTheme(option)}
                    style={[
                      styles.themePill,
                      {
                        backgroundColor: selected ? readerColors.activeFill : readerColors.pillBg,
                        borderColor: selected ? readerColors.activeFill : readerColors.pillBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.themePillText, { color: selected ? readerColors.activeText : readerColors.text }]}>
                      {READER_THEMES[option].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
      {missing ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: readerColors.text }]}>This paper is not in the library.</Text>
        </View>
      ) : null}
      {status && !missing ? (
        <View style={styles.center}>
          <ActivityIndicator color={readerColors.accent} />
          <Text style={[styles.status, { color: readerColors.text2 }]}>{status}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: readerColors.text }]}>{error}</Text>
          {item?.sourceUrl ? (
            <Text style={[styles.back, { color: readerColors.accent }]} onPress={() => void Linking.openURL(item.sourceUrl)}>Open official page</Text>
          ) : null}
        </View>
      ) : null}
      {uri ? (
        <PdfFrame
          ref={frame}
          uri={uri}
          onMessage={onMessage}
          readAccessUrl={readerReadAccessUrl()}
          backgroundColor={readerColors.canvas}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chrome: { borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6 },
  back: { fontSize: 16, fontWeight: '600', paddingVertical: 6 },
  title: { flex: 1, fontWeight: '600', fontSize: 15 },
  pageInput: { width: 44, borderRadius: 8, borderWidth: 1, textAlign: 'center', paddingVertical: 4, fontSize: 14, fontWeight: '600' },
  pages: { fontSize: 13, marginRight: 2 },
  zoom: { width: 32, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 18, lineHeight: 20, fontWeight: '600' },
  fitBtn: { height: 30, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fitText: { fontSize: 12.5, fontWeight: '700' },
  bookmarkBtn: { marginLeft: 'auto', paddingVertical: 4 },
  bookmark: { fontSize: 14, fontWeight: '700', paddingHorizontal: 4 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  themeLabel: { fontSize: 12.5, fontWeight: '600', marginRight: 2 },
  themePill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  themePillText: { fontSize: 12, fontWeight: '600' },
  center: { padding: 24, alignItems: 'center', gap: 10 },
  status: { fontSize: 15 },
  error: { textAlign: 'center', lineHeight: 21, fontSize: 15 },
});
