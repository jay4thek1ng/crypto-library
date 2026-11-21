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
import { theme } from '../src/theme';
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
  const gap = 14;
  const cols = width >= 980 ? 6 : width >= 760 ? 5 : 3;
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Library</Text>
          <Text style={styles.count}>{library.items.length}</Text>
          <View style={styles.titleActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/settings')}><Text style={styles.link}>Settings</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void choosePdf()}><Text style={styles.upload}>+ Upload</Text></Pressable>
          </View>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles, projects, authors"
          placeholderTextColor={theme.text3}
          style={styles.search}
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
        <View style={styles.sortRow}>
          {SORTS.map((item) => (
            <Pressable key={item.key} accessibilityRole="button" onPress={() => setSort(item.key)} style={[styles.sort, sort === item.key && styles.sortOn]}>
              <Text style={[styles.sortText, sort === item.key && styles.sortTextOn]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.main}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.accent2} onRefresh={() => { setRefreshing(true); void library.refreshCommunity().finally(() => setRefreshing(false)); }} />}
      >
        {!filtering && reading.length > 0 ? (
          <View style={styles.shelf}>
            <View style={styles.shelfHead}>
              <Text style={styles.shelfTitle}>Reading Now</Text>
              <Pressable accessibilityRole="button" onPress={library.clearReading}><Text style={styles.accent}>Clear</Text></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {reading.map((item) => item ? <PaperCard key={item.id} item={item} width={124} /> : null)}
            </ScrollView>
          </View>
        ) : null}
        {!filtering && want.length > 0 ? (
          <View style={styles.shelf}>
            <View style={styles.shelfHead}>
              <Text style={styles.shelfTitle}>Want to Read</Text>
              <Text style={styles.shelfMeta}>{want.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {want.map((item) => item ? <PaperCard key={item.id} item={item} width={124} /> : null)}
            </ScrollView>
          </View>
        ) : null}
        {!filtering && bookmarks.length > 0 ? (
          <View style={styles.shelf}>
            <View style={styles.shelfHead}>
              <Text style={styles.shelfTitle}>Bookmarks</Text>
              <Text style={styles.shelfMeta}>{bookmarks.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {bookmarks.map(({ bookmark, item }) => item ? (
                <PaperCard
                  key={`${bookmark.paperId}:${bookmark.page}`}
                  item={item}
                  width={124}
                  caption={`Page ${bookmark.page}`}
                  onPress={() => router.push({ pathname: '/read/[id]', params: { id: item.id, page: String(bookmark.page) } })}
                />
              ) : null)}
            </ScrollView>
          </View>
        ) : null}
        {visibleShelves.map(({ item, papers }) => (
          <View key={item.key} style={styles.shelf}>
            <View style={styles.shelfHead}>
              <Text style={styles.shelfTitle}>{SHELVES[item.key].label}</Text>
              <Text style={styles.shelfMeta}>{papers.length} {papers.length === 1 ? 'paper' : 'papers'}</Text>
            </View>
            {item.key === 'CM' ? (
              <View style={styles.communityNoteRow}>
                {library.communityStatus === 'error' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading community library"
                    onPress={() => void library.refreshCommunity()}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryText}>{library.communityMessage}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.note}>{library.communityMessage}</Text>
                )}
                <Pressable accessibilityRole="button" onPress={() => void choosePdf()}>
                  <Text style={styles.linkInline}>Upload a white paper</Text>
                </Pressable>
              </View>
            ) : null}
            {papers.length === 0 ? (
              <Text style={styles.empty}>
                {library.communityStatus === 'loading'
                  ? 'Loading…'
                  : hasQuery
                    ? 'No community uploads match your search.'
                    : 'No community uploads yet. Be the first to share one.'}
              </Text>
            ) : (
              <View style={[styles.grid, { gap }]}>
                {papers.map((paper) => <PaperCard key={paper.id} item={paper} width={coverW} />)}
              </View>
            )}
          </View>
        ))}
        {filtering && visibleShelves.length === 0 ? <Text style={styles.empty}>No papers match these filters.</Text> : null}
        <Text style={styles.footer}>
          Metadata comes from the official source for each project. PDFs open from their existing URLs and are saved on this device after you read them. The Community shelf is shared through the public library. PDF rendering by Mozilla PDF.js.
        </Text>
      </ScrollView>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  title: { color: theme.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.6 },
  count: { color: theme.text3, fontSize: 15, marginTop: 8 },
  titleActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 14 },
  link: { color: theme.accent2, fontSize: 15, fontWeight: '600' },
  upload: { color: theme.white, backgroundColor: theme.accent, overflow: 'hidden', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, fontWeight: '700', fontSize: 14 },
  search: { marginTop: 12, backgroundColor: theme.fill, color: theme.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chips: { gap: 8, paddingVertical: 10 },
  chip: { backgroundColor: theme.fill, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: theme.paper },
  chipText: { color: theme.text2, fontSize: 14 },
  chipTextOn: { color: theme.text, fontWeight: '700' },
  sortRow: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: theme.fill, borderRadius: 8, padding: 2, marginBottom: 8 },
  sort: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  sortOn: { backgroundColor: theme.paper },
  sortText: { color: theme.text2, fontSize: 14 },
  sortTextOn: { color: theme.text, fontWeight: '700' },
  main: { paddingHorizontal: 16, paddingBottom: 40 },
  shelf: { marginTop: 22 },
  shelfHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line, paddingTop: 14, marginBottom: 12 },
  shelfTitle: { color: theme.text, fontSize: 22, fontWeight: '700' },
  shelfMeta: { color: theme.text3, fontSize: 14 },
  accent: { color: theme.accent, fontSize: 15 },
  row: { gap: 16, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  communityNoteRow: { marginTop: -4, marginBottom: 12, gap: 4 },
  note: { color: theme.text2, fontSize: 13.5, lineHeight: 19 },
  retryButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  retryText: { color: theme.accent, fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  linkInline: { color: theme.accent2, fontSize: 13.5, lineHeight: 19 },
  empty: { color: theme.text2, fontSize: 15, paddingVertical: 8 },
  footer: { color: theme.text3, fontSize: 13, lineHeight: 18, marginTop: 28 },
});
