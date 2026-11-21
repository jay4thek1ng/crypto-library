import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { APP_VERSION } from '../src/lib/config';
import { supportsFileCache } from '../src/lib/files';
import { useLibrary } from '../src/lib/library-context';
import { formatBytes } from '../src/lib/offline-cache';
import type { AppearanceMode, ReaderThemeMode } from '../src/lib/storage';
import { READER_THEMES, useTheme } from '../src/theme';

const APPEARANCE_OPTIONS: { key: AppearanceMode; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

const READER_OPTIONS: ReaderThemeMode[] = ['white', 'sepia', 'dark'];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const library = useLibrary();
  const colors = useTheme();
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
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
    >
      <Text style={[styles.back, { color: colors.accent2 }]} onPress={() => router.back()} accessibilityRole="button">‹ Library</Text>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Text style={[styles.lead, { color: colors.text2 }]}>Crypto White Paper Digital Book {APP_VERSION}</Text>

      <View style={[styles.card, cardSurface]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Appearance</Text>
        <Text style={[styles.body, { color: colors.text2 }]}>Choose how the library and menus look.</Text>
        <View style={styles.pillRow}>
          {APPEARANCE_OPTIONS.map((option) => {
            const selected = library.appearance === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={`Appearance ${option.label}`}
                onPress={() => library.setAppearance(option.key)}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: selected ? colors.accent : colors.fill,
                    borderColor: selected ? colors.accent : colors.pillBorder,
                  },
                ]}
              >
                <Text style={[styles.optionLabel, { color: selected ? colors.accentOnFill : colors.text }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.subTitle, { color: colors.text }]}>Reader page theme</Text>
        <Text style={[styles.body, { color: colors.text2 }]}>Separate page canvas and paper tone for reading PDFs.</Text>
        <View style={styles.pillRow}>
          {READER_OPTIONS.map((option) => {
            const selected = library.readerTheme === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Reader theme ${READER_THEMES[option].label}`}
                onPress={() => library.setReaderTheme(option)}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: selected ? colors.accent : colors.fill,
                    borderColor: selected ? colors.accent : colors.pillBorder,
                  },
                ]}
              >
                <Text style={[styles.optionLabel, { color: selected ? colors.accentOnFill : colors.text }]}>
                  {READER_THEMES[option].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, cardSurface]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Offline papers</Text>
        <Text style={[styles.body, { color: colors.text2 }]}>
          {supportsFileCache()
            ? `${library.cache.length} ${library.cache.length === 1 ? 'file' : 'files'} · ${formatBytes(library.storageBytes)}`
            : 'Downloads are stored with expo-file-system on Android and iOS. This web preview reads papers from their URLs and does not keep a device cache.'}
        </Text>
        <Text style={[styles.body, { color: colors.text2 }]}>Opening a PDF saves it on the device. The next open works without a network connection, including the last page you were on.</Text>
        <Button label={busy ? 'Clearing…' : armed ? 'Tap again to clear downloads' : 'Clear downloads'} kind="danger" disabled={busy || !supportsFileCache()} onPress={() => void clear()} />
      </View>

      <View style={[styles.card, cardSurface]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Lists</Text>
        <Text style={[styles.body, { color: colors.text2 }]}>Reading Now {library.state.readingNow.length} · Want to Read {library.state.want.length} · Bookmarks {library.state.bookmarks.length}</Text>
        {library.state.bookmarks.slice(0, 12).map((bookmark) => {
          const item = library.find(bookmark.paperId);
          if (!item) return null;
          return (
            <Text key={`${bookmark.paperId}:${bookmark.page}`} style={[styles.link, { color: colors.accent2 }]} onPress={() => router.push({ pathname: '/read/[id]', params: { id: item.id, page: String(bookmark.page) } })}>
              {item.project}: {item.title} · p. {bookmark.page}
            </Text>
          );
        })}
      </View>

      <Text style={[styles.fine, { color: colors.text3 }]}>
        Package io.github.jay4thek1ng.cryptolibrary. Community uploads use only the public Supabase anon key. PDFs are not bundled; they are fetched from the library that already hosts them.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { fontSize: 17, fontWeight: '600', paddingVertical: 8 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 6 },
  lead: { marginBottom: 16, fontSize: 15 },
  card: { padding: 16, gap: 10, marginBottom: 14 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  subTitle: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  body: { fontSize: 15, lineHeight: 21 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  link: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  fine: { fontSize: 13, lineHeight: 18, marginTop: 8 },
});
