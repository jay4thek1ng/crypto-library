import { Image, StyleSheet, Text, View } from 'react-native';
import { COVERS } from '../data/covers';
import { SHELVES } from '../data/shelves';
import { theme } from '../theme';
import type { LibraryItem } from '../types';

export function Cover({ item, width, saved }: { item: LibraryItem; width: number; saved?: boolean }) {
  const shelf = SHELVES[item.shelf];
  const bundled = item.cover ? COVERS[item.cover] : undefined;
  const source = item.coverUri ? { uri: item.coverUri } : bundled;
  return (
    <View style={[styles.cover, { width, height: Math.round(width * 1.5), backgroundColor: shelf.from }]}>
      {source ? <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : (
        <View style={styles.fallback}>
          <Text style={styles.ticker} numberOfLines={1}>{item.ticker || shelf.label}</Text>
          <Text style={styles.title} numberOfLines={6}>{item.title}</Text>
        </View>
      )}
      <View style={styles.spine} />
      {saved || item.origin !== 'catalog' ? (
        <Text style={styles.badge}>{saved ? 'SAVED' : item.origin === 'private' ? 'PRIVATE' : 'COMMUNITY'}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 4, borderTopRightRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden' },
  fallback: { flex: 1, paddingTop: 14, paddingRight: 10, paddingBottom: 12, paddingLeft: 16, justifyContent: 'space-between' },
  ticker: { color: theme.white, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', opacity: 0.9 },
  title: { color: theme.white, fontSize: 13, lineHeight: 16, fontWeight: '700' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(0,0,0,0.28)' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    color: theme.white,
    backgroundColor: 'rgba(0,0,0,0.62)',
    overflow: 'hidden',
    borderRadius: 999,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
