import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaperCard } from '../src/components/PaperCard';
import { isShelfKey, SHELF_ORDER, SHELVES } from '../src/data/shelves';
import type { ShelfKey } from '../src/data/shelves';
import { getDocumentAsync } from 'expo-document-picker';
import { setPendingUpload } from '../src/lib/pending-upload';
import { useLibrary } from '../src/lib/library-context';
import { papersOnShelf, searchPapers } from '../src/lib/search';
import { useTheme } from '../src/theme';
import type { SortKey } from '../src/types';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'year', label: 'Newest' },
  { key: 'title', label: 'Title' },
  { key: 'project', label: 'Project' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; shelf?: string }>();
  const library = useLibrary();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const initialShelf = typeof params.shelf === 'string' && (params.shelf === 'all' || isShelfKey(params.shelf)) ? params.shelf : 'all';
  const [shelf, setShelf] = useState<ShelfKey | 'all'>(initialShelf);
  const [sort, setSort] = useState<SortKey>('year');
  const [refreshing, setRefreshing] = useState(false);

  const searched = useMemo(() => searchPapers(library.items, query), [library.items, query]);
  const hasQuery = query.trim().length > 0;
  const filtering = hasQuery || shelf !== 'all';
  const visibleShelves = useMemo(
    () => SHELF_ORDER
      .filter((item) => shelf === 'all' || shelf === item.key)
      .map((item) => ({ item, papers: papersOnShelf(searched, item.key, sort) }))
      .filter(({ item, papers }) => papers.length > 0 || (item.key === 'CM' && (shelf === 'CM' || !hasQuery))),
    [hasQuery, searched, shelf, sort],
  );

  const pad = 16;
  const gap = 18;
  const cols = width >= 980 ? 5 : width >= 760 ? 4 : 2;
  const coverW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  const reading = library.state.readingNow.map((id) => library.find(id)).filter((item) => item != null);
  const want = library.state.want.map((id) => library.find(id)).filter((item) => item != null);
  const bookmarks = library.state.bookmarks
    .map((bookmark) => ({ bookmark, item: library.find(bookmark.paperId) }))
    .filter((row) => row.item != null);

  async function choosePdf() {
    const result = await getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, base64: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingUpload({ uri: asset.uri, name: asset.name, size: asset.size ?? asset.file?.size ?? 0, mimeType: asset.mimeType, webFile: asset.file });
    router.push('/upload');
  }

  const cardSurface = {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    ...(colors.mode === 'light'
      ? { shadowColor: colors.shadow, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
      : null),
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.line }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>Library</Text>
          <Text style={[styles.count, { color: colors.text3 }]}>{library.items.length}</Text>
          <View style={styles.titleActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/settings')}>
              <Text style={[styles.link, { color: colors.accent2 }]}>Settings</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void choosePdf()}
              style={[styles.uploadPill, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.upload, { color: colors.accentOnFill }]}>+ Upload</Text>
            </Pressable>
          </View>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles, projects, authors"
          placeholderTextColor={colors.text3}
          selectionColor={colors.accent}
          keyboardAppearance={colors.mode}
          style={[
            styles.search,
            {
              backgroundColor: colors.paper,
              color: colors.text,
              borderColor: colors.pillBorder,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All shelves" selected={shelf === 'all'} onPress={() => setShelf('all')} />
          {SHELF_ORDER.map((item) => (
            <Chip key={item.key} label={item.label} selected={shelf === item.key} onPress={() => setShelf(item.key)} />
          ))}
        </ScrollView>
        <View style={[styles.sortRow, { backgroundColor: colors.fill, borderColor: colors.pillBorder, borderWidth: StyleSheet.hairlineWidth }]}>
          {SORTS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={() => setSort(item.key)}
              style={[styles.sort, sort === item.key && [styles.sortOn, { backgroundColor: colors.paper }]]}
            >
              <Text style={[styles.sortText, { color: colors.text2 }, sort === item.key && [styles.sortTextOn, { color: colors.text }]]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.main, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            colors={[colors.accent]}
            onRefresh={() => {
              setRefreshing(true);
              void library.refreshCommunity().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {!filtering && reading.length > 0 ? (
          <View style={styles.shelf}>
            <View style={[styles.shelfHead, { borderTopColor: colors.line }]}>
              <Text style={[styles.shelfTitle, { color: colors.text }]}>Reading Now</Text>
              <Pressable accessibilityRole="button" onPress={library.clearReading}>
                <Text style={[styles.clearLink, { color: colors.accent2 }]}>Clear</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {reading.map((item) => item ? <PaperCard key={item.id} item={item} width={138} /> : null)}
            </ScrollView>
          </View>
        ) : null}
        {!filtering && want.length > 0 ? (
          <View style={styles.shelf}>
            <View style={[styles.shelfHead, { borderTopColor: colors.line }]}>
              <Text style={[styles.shelfTitle, { color: colors.text }]}>Want to Read</Text>
              <Text style={[styles.shelfMeta, { color: colors.text3 }]}>{want.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {want.map((item) => item ? <PaperCard key={item.id} item={item} width={138} /> : null)}
            </ScrollView>
          </View>
        ) : null}
        {!filtering && bookmarks.length > 0 ? (
          <View style={styles.shelf}>
            <View style={[styles.shelfHead, { borderTopColor: colors.line }]}>
              <Text style={[styles.shelfTitle, { color: colors.text }]}>Bookmarks</Text>
              <Text style={[styles.shelfMeta, { color: colors.text3 }]}>{bookmarks.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {bookmarks.map(({ bookmark, item }) => item ? (
                <PaperCard
                  key={`${bookmark.paperId}:${bookmark.page}`}
                  item={item}
                  width={138}
                  caption={`Page ${bookmark.page}`}
                  onPress={() => router.push({ pathname: '/read/[id]', params: { id: item.id, page: String(bookmark.page) } })}
                />
              ) : null)}
            </ScrollView>
          </View>
        ) : null}
        {visibleShelves.map(({ item, papers }) => {
          const bannerActive = item.key === 'CM' && (library.communityStatus === 'offline' || library.communityStatus === 'error');
          const hideEmptyPrompt = bannerActive && papers.length === 0;
          return (
            <View key={item.key} style={styles.shelf}>
              <View style={[styles.shelfHead, { borderTopColor: colors.line }]}>
                <Text style={[styles.shelfTitle, { color: colors.text }]}>{SHELVES[item.key].label}</Text>
                <Text style={[styles.shelfMeta, { color: colors.text3 }]}>{papers.length} {papers.length === 1 ? 'paper' : 'papers'}</Text>
              </View>
              {item.key === 'CM' ? (
                <View style={[styles.communityCard, cardSurface]}>
                  {library.communityStatus === 'error' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading community library"
                      onPress={() => void library.refreshCommunity()}
                      style={[
                        styles.banner,
                        {
                          backgroundColor: colors.bannerErrorBg,
                          borderColor: colors.bannerErrorBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.bannerText, { color: colors.bannerErrorText }]}>{library.communityMessage}</Text>
                    </Pressable>
                  ) : library.communityStatus === 'offline' ? (
                    <View
                      style={[
                        styles.banner,
                        {
                          backgroundColor: colors.bannerOfflineBg,
                          borderColor: colors.bannerOfflineBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.bannerText, { color: colors.bannerOfflineText }]}>{library.communityMessage}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.note, { color: colors.text2 }]}>{library.communityMessage}</Text>
                  )}
                  <Pressable accessibilityRole="button" onPress={() => void choosePdf()} style={styles.uploadInlineBtn}>
                    <Text style={[styles.linkInline, { color: colors.accent2 }]}>Upload a white paper</Text>
                  </Pressable>
                  {papers.length === 0 && !hideEmptyPrompt ? (
                    <Text style={[styles.empty, { color: colors.text2 }]}>
                      {library.communityStatus === 'loading'
                        ? 'Loading…'
                        : hasQuery
                          ? 'No community uploads match your search.'
                          : 'No community uploads yet. Be the first to share one.'}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {papers.length > 0 ? (
                <View style={[styles.grid, { gap }]}>
                  {papers.map((paper) => <PaperCard key={paper.id} item={paper} width={coverW} />)}
                </View>
              ) : null}
            </View>
          );
        })}
        {filtering && visibleShelves.length === 0 ? (
          <View style={[styles.emptyCard, cardSurface]}>
            <Text style={[styles.empty, { color: colors.text2 }]}>No papers match these filters.</Text>
          </View>
        ) : null}
        <Text style={[styles.footer, { color: colors.text3 }]}>
          Metadata comes from the official source for each project. PDFs open from their existing URLs and are saved on this device after you read them. The Community shelf is shared through the public library. PDF rendering by Mozilla PDF.js.
        </Text>
      </ScrollView>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.fill,
          borderColor: selected ? colors.accent : colors.pillBorder,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.accentOnFill : colors.text }, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6 },
  count: { fontSize: 15, marginTop: 8 },
  titleActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 14 },
  link: { fontSize: 15, fontWeight: '600' },
  uploadPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  upload: { fontWeight: '700', fontSize: 14 },
  search: { marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  chips: { gap: 8, paddingVertical: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipTextOn: { fontWeight: '700' },
  sortRow: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 10, padding: 3, marginBottom: 4 },
  sort: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sortOn: {},
  sortText: { fontSize: 14 },
  sortTextOn: { fontWeight: '700' },
  main: { paddingHorizontal: 16 },
  shelf: { marginTop: 22 },
  shelfHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginBottom: 14 },
  shelfTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  shelfMeta: { fontSize: 14, fontWeight: '500' },
  clearLink: { fontSize: 15, fontWeight: '600' },
  row: { gap: 18, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  communityCard: { padding: 14, gap: 8, marginBottom: 14 },
  banner: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  bannerText: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  note: { fontSize: 14, lineHeight: 20 },
  uploadInlineBtn: { alignSelf: 'flex-start', paddingVertical: 2 },
  linkInline: { fontSize: 14.5, lineHeight: 20, fontWeight: '600' },
  emptyCard: { marginTop: 20, padding: 16 },
  empty: { fontSize: 15, paddingVertical: 4 },
  footer: { fontSize: 13, lineHeight: 18, marginTop: 28 },
});
