import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { kindLabel } from '../lib/catalog';
import { useLibrary } from '../lib/library-context';
import { useTheme } from '../theme';
import type { LibraryItem } from '../types';
import { Cover } from './Cover';

export function PaperCard({ item, width, onPress, caption }: { item: LibraryItem; width: number; onPress?: () => void; caption?: string }) {
  const router = useRouter();
  const library = useLibrary();
  const colors = useTheme();
  const wanted = library.isWanted(item.id);
  const saved = library.cache.some((record) => record.id === item.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption ? `${item.title}, ${caption}` : item.title}
      onPress={onPress ?? (() => router.push({ pathname: '/paper/[id]', params: { id: item.id } }))}
      style={{ width }}
    >
      <Cover item={item} width={width} saved={saved} />
      <Text style={[styles.project, { color: colors.text }]} numberOfLines={1}>{item.project || item.title}</Text>
      <Text style={[styles.sub, { color: colors.text3 }]} numberOfLines={1}>
        {caption ?? `${item.year ?? 'Undated'} · ${kindLabel(item)}${wanted ? ' · Want to Read' : ''}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  project: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
});
