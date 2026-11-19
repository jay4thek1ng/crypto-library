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
import { theme } from '../../src/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function PaperScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = param(useLocalSearchParams<{ id: string }>().id);
  const library = useLibrary();
  const item = library.find(id);
  const saved = library.cache.some((record) => record.id === id);

  useEffect(() => {
    if (item) library.touchReading(item.id);
    // Touch once per open. touchReading updates context, so it must not be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.back} onPress={() => router.back()}>‹ Library</Text>
        <Text style={styles.missing}>{library.communityStatus === 'loading' && id.startsWith('c-') ? 'Loading this paper…' : 'This paper is not in the library.'}</Text>
      </View>
    );
  }

  const shelves = item.origin === 'community'
    ? `Community${item.topic ? ` · ${SHELVES[item.topic].label}` : ''}`
    : [SHELVES[item.shelf].label, ...item.tags.map((tag) => SHELVES[tag].label)].join(', ');
  const bookmarks = library.state.bookmarks.filter((bookmark) => bookmark.paperId === item.id);
  const canRead = item.kind === 'pdf' || item.kind === 'html' || item.origin === 'private';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28, paddingHorizontal: 20 }}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">‹ Library</Text>
      <View style={styles.hero}><Cover item={item} width={170} saved={saved} /></View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.by}>{item.authors || (item.origin === 'community' ? 'Shared by a community member' : 'Authors not stated')}</Text>
      <View style={styles.props}>
        <Prop label="Project" value={item.project || '—'} />
        {item.origin === 'catalog' ? <Prop label="Ticker" value={item.ticker || 'None'} /> : null}
        <Prop label="Year" value={item.year ? String(item.year) : 'Undated or living document'} />
        <Prop label="Shelf" value={shelves} />
        <Prop label="Format" value={formatLine(item.kind, item.origin, item.size, item.pages, saved)} />
      </View>
      {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
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
        <View style={styles.marks}>
          <Text style={styles.markTitle}>Bookmarks</Text>
          {bookmarks.map((bookmark) => (
            <Text
              key={bookmark.page}
              style={styles.mark}
              onPress={() => router.push({ pathname: '/read/[id]', params: { id: item.id, page: String(bookmark.page) } })}
            >
              Page {bookmark.page}
            </Text>
          ))}
        </View>
      ) : null}
      {item.origin === 'community' ? (
        <Text style={styles.src}>Uploaded by a user of this app and visible to everyone. It has not been reviewed: report anything spam, offensive or infringing.</Text>
      ) : item.sourceUrl ? <Text style={styles.src}>{item.sourceUrl}</Text> : null}
      <Text style={styles.kind}>{kindLabel(item)}{saved ? ' · saved on this device' : ''}</Text>
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
  return (
    <View style={styles.prop}>
      <Text style={styles.propLabel}>{label}</Text>
      <Text style={styles.propValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  back: { color: theme.accent2, fontSize: 17, paddingVertical: 8 },
  missing: { color: theme.text2, fontSize: 16, marginTop: 24 },
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  title: { color: theme.text, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  by: { color: theme.text2, fontSize: 15, marginTop: 6, marginBottom: 14 },
  props: { gap: 8, marginBottom: 14 },
  prop: { flexDirection: 'row', gap: 12 },
  propLabel: { color: theme.text3, width: 72, fontSize: 14 },
  propValue: { color: theme.text, flex: 1, fontSize: 14 },
  summary: { color: theme.text, fontSize: 16, lineHeight: 23, marginBottom: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  marks: { marginTop: 20 },
  markTitle: { color: theme.text, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  mark: { color: theme.accent2, fontSize: 15, paddingVertical: 4 },
  src: { color: theme.text3, fontSize: 12.5, marginTop: 16, lineHeight: 18 },
  kind: { color: theme.text3, fontSize: 12, marginTop: 8 },
});
