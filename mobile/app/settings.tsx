import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { APP_VERSION } from '../src/lib/config';
import { supportsFileCache } from '../src/lib/files';
import { useLibrary } from '../src/lib/library-context';
import { formatBytes } from '../src/lib/offline-cache';
import { theme } from '../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const library = useLibrary();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function clear() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3500);
      return;
    }
    setBusy(true);
    try {
      await library.clearDownloads();
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">‹ Library</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.lead}>Crypto White Paper Digital Book {APP_VERSION}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Offline papers</Text>
        <Text style={styles.body}>
          {supportsFileCache()
            ? `${library.cache.length} ${library.cache.length === 1 ? 'file' : 'files'} · ${formatBytes(library.storageBytes)}`
            : 'Downloads are stored with expo-file-system on Android and iOS. This web preview reads papers from their URLs and does not keep a device cache.'}
        </Text>
        <Text style={styles.body}>Opening a PDF saves it on the device. The next open works without a network connection, including the last page you were on.</Text>
        <Button label={busy ? 'Clearing…' : armed ? 'Tap again to clear downloads' : 'Clear downloads'} kind="danger" disabled={busy || !supportsFileCache()} onPress={() => void clear()} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lists</Text>
        <Text style={styles.body}>Reading Now {library.state.readingNow.length} · Want to Read {library.state.want.length} · Bookmarks {library.state.bookmarks.length}</Text>
        {library.state.bookmarks.slice(0, 12).map((bookmark) => {
          const item = library.find(bookmark.paperId);
          if (!item) return null;
          return (
            <Text key={`${bookmark.paperId}:${bookmark.page}`} style={styles.link} onPress={() => router.push({ pathname: '/read/[id]', params: { id: item.id, page: String(bookmark.page) } })}>
              {item.project}: {item.title} · p. {bookmark.page}
            </Text>
          );
        })}
      </View>
      <Text style={styles.fine}>
        Package io.github.jay4thek1ng.cryptolibrary. Community uploads use only the public Supabase anon key. PDFs are not bundled; they are fetched from the library that already hosts them.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  back: { color: theme.accent2, fontSize: 17, paddingVertical: 8 },
  title: { color: theme.text, fontSize: 32, fontWeight: '700', marginBottom: 6 },
  lead: { color: theme.text2, marginBottom: 16 },
  card: { backgroundColor: theme.paper, borderRadius: 14, padding: 16, gap: 10, marginBottom: 14 },
  cardTitle: { color: theme.text, fontSize: 18, fontWeight: '700' },
  body: { color: theme.text2, fontSize: 15, lineHeight: 21 },
  link: { color: theme.accent2, fontSize: 15, lineHeight: 21 },
  fine: { color: theme.text3, fontSize: 13, lineHeight: 18, marginTop: 8 },
});
