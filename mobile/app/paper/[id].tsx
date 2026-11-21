import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Button } from '../../src/components/Button';
import { Cover } from '../../src/components/Cover';
import { SHELVES } from '../../src/data/shelves';
import { kindLabel } from '../../src/lib/catalog';
import { useLibrary } from '../../src/lib/library-context';
import { formatBytes } from '../../src/lib/offline-cache';
import { useTheme } from '../../src/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function PaperScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = param(useLocalSearchParams<{ id: string }>().id);
  const library = useLibrary();
  const colors = useTheme();
  const item = library.find(id);
  const saved = library.cache.some((record) => record.id === id);

  useEffect(() => {
    if (item) library.touchReading(item.id);
    // Touch once per open. touchReading updates context, so it must not be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20, backgroundColor: colors.bg }]}>
        <Text style={[styles.back, { color: colors.accent2 }]} onPress={() => router.back()}>‹ Library</Text>
        <Text style={[styles.missing, { color: colors.text2 }]}>
          {library.communityStatus === 'loading' && id.startsWith('c-') ? 'Loading this paper…' : 'This paper is not in the library.'}
        </Text>
      </View>
    );
  }

  const shelves = item.origin === 'community'
    ? `Community${item.topic ? ` · ${SHELVES[item.topic].label}` : ''}`
    : [SHELVES[item.shelf].label, ...item.tags.map((tag) => SHELVES[tag].label)].join(', ');
  const bookmarks = library.state.bookmarks.filter((bookmark) => bookmark.paperId === item.id);
  const canRead = item.kind === 'pdf' || item.kind === 'html' || item.origin === 'private';
  const cardSurface = {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    ...(colors.mode === 'light'
      ? { shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }
      : null),
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28, paddingHorizontal: 20 }}
    >
      <Text style={[styles.back, { color: colors.accent2 }]} onPress={() => router.back()} accessibilityRole="button">‹ Library</Text>
      <View style={styles.hero}><Cover item={item} width={176} saved={saved} /></View>
      <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.by, { color: colors.text2 }]}>{item.authors || (item.origin === 'community' ? 'Shared by a community member' : 'Authors not stated')}</Text>
      <View style={[styles.propsCard, cardSurface]}>
        <Prop label="Project" value={item.project || '—'} />
        {item.origin === 'catalog' ? <Prop label="Ticker" value={item.ticker || 'None'} /> : null}
        <Prop label="Year" value={item.year ? String(item.year) : 'Undated or living document'} />
        <Prop label="Shelf" value={shelves} />
        <Prop label="Format" value={formatLine(item.kind, item.origin, item.size, item.pages, saved)} />
      </View>
      {item.summary ? <Text style={[styles.summary, { color: colors.text }]}>{item.summary}</Text> : null}
      <View style={styles.actions}>
        {canRead ? (
          <Button label={item.kind === 'html' ? 'Read document' : 'Read'} kind="primary" onPress={() => router.push({ pathname: '/read/[id]', params: { id: item.id } })} />
        ) : null}
        <Button label={library.isWanted(item.id) ? '✓ Want to Read' : '+ Want to Read'} onPress={() => library.toggleWant(item.id)} />
        {item.sourceUrl ? <Button label="Open official page" onPress={() => void Linking.openURL(item.sourceUrl)} /> : null}
        {item.origin === 'community' ? (
          <Button
            label={item.communityId && library.isReported(item.communityId) ? 'Reported' : 'Report'}
            kind="danger"
            disabled={!item.communityId || library.isReported(item.communityId)}
            onPress={() => router.push({ pathname: '/report/[id]', params: { id: item.id } })}
          />
        ) : null}
      </View>
      {bookmarks.length > 0 ? (
        <View style={[styles.marks, cardSurface]}>
          <Text style={[styles.markTitle, { color: colors.text }]}>Bookmarks</Text>
          {bookmarks.map((bookmark) => (
            <Text
              key={bookmark.page}
              style={[styles.mark, { color: colors.accent2 }]}
              onPress={() => router.push({ pathname: '/read/[id]', params: { id: item.id, page: String(bookmark.page) } })}
            >
              Page {bookmark.page}
            </Text>
          ))}
        </View>
      ) : null}
      {item.origin === 'community' ? (
        <Text style={[styles.src, { color: colors.text3 }]}>Uploaded by a user of this app and visible to everyone. It has not been reviewed: report anything spam, offensive or infringing.</Text>
      ) : item.sourceUrl ? <Text style={[styles.src, { color: colors.text3 }]}>{item.sourceUrl}</Text> : null}
      <Text style={[styles.kind, { color: colors.text3 }]}>{kindLabel(item)}{saved ? ' · saved on this device' : ''}</Text>
    </ScrollView>
  );
}

function formatLine(kind: string, origin: string, size: number, pages: number, saved: boolean): string {
  if (origin === 'community') {
    return `PDF · community upload${size ? ` · ${formatBytes(size)}` : ''}${pages ? ` · ${pages} pages` : ''}${saved ? ' · saved offline' : ''}`;
  }
  if (kind === 'html') return 'Web document';
  if (kind === 'external') return 'Official page';
  return saved ? 'PDF · saved offline' : 'PDF';
}

function Prop({ label, value }: { label: string; value: string }) {
  const colors = useTheme();
  return (
    <View style={styles.prop}>
      <Text style={[styles.propLabel, { color: colors.text3 }]}>{label}</Text>
      <Text style={[styles.propValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { fontSize: 17, fontWeight: '600', paddingVertical: 8 },
  missing: { fontSize: 16, marginTop: 24 },
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  by: { fontSize: 15, marginTop: 6, marginBottom: 14 },
  propsCard: { padding: 14, gap: 8, marginBottom: 16 },
  prop: { flexDirection: 'row', gap: 12 },
  propLabel: { width: 72, fontSize: 14 },
  propValue: { flex: 1, fontSize: 14, fontWeight: '500' },
  summary: { fontSize: 16, lineHeight: 23, marginBottom: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  marks: { marginTop: 20, padding: 14 },
  markTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  mark: { fontSize: 15, fontWeight: '600', paddingVertical: 4 },
  src: { fontSize: 12.5, marginTop: 16, lineHeight: 18 },
  kind: { fontSize: 12, marginTop: 8 },
});
