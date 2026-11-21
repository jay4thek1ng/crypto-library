import { Image, StyleSheet, Text, View } from 'react-native';
import { COVERS } from '../data/covers';
import { SHELVES } from '../data/shelves';
import { SHELF_TINTS, useTheme } from '../theme';
import type { LibraryItem } from '../types';

export function Cover({ item, width, saved }: { item: LibraryItem; width: number; saved?: boolean }) {
  const colors = useTheme();
  const shelf = SHELVES[item.shelf];
  const tint = SHELF_TINTS[item.shelf];
  const bundled = item.cover ? COVERS[item.cover] : undefined;
  const source = item.coverUri ? { uri: item.coverUri } : bundled;
  const isLight = colors.mode === 'light';
  const fallbackBg = isLight ? tint.bg : shelf.from;
  const fallbackTextColor = isLight ? colors.text : colors.white;
  const fallbackSubColor = isLight ? colors.text2 : colors.white;
  const marker = item.ticker || (item.project || item.title).trim().slice(0, 1).toUpperCase() || shelf.label;

  return (
    <View
      style={[
        styles.cover,
        {
          width,
          height: Math.round(width * 1.5),
          backgroundColor: fallbackBg,
          borderColor: source ? colors.line : isLight ? tint.border : colors.line,
        },
      ]}
    >
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.fallback}>
          <View style={styles.markerRow}>
            <Text style={[styles.ticker, { color: fallbackSubColor }]} numberOfLines={1}>
              {marker}
            </Text>
          </View>
          <Text style={[styles.title, { color: fallbackTextColor }]} numberOfLines={6}>
            {item.title}
          </Text>
        </View>
      )}
      <View style={[styles.spine, { backgroundColor: isLight && !source ? 'rgba(31,31,31,0.08)' : 'rgba(0,0,0,0.22)' }]} />
      {saved || item.origin !== 'catalog' ? (
        <Text style={styles.badge}>{saved ? 'SAVED' : item.origin === 'private' ? 'PRIVATE' : 'COMMUNITY'}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 6, borderTopRightRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  fallback: { flex: 1, paddingTop: 14, paddingRight: 10, paddingBottom: 12, paddingLeft: 16, justifyContent: 'space-between' },
  markerRow: { flexDirection: 'row', alignItems: 'center' },
  ticker: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 13.5, lineHeight: 17, fontWeight: '700' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 8 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    color: '#FFFFFF',
    backgroundColor: 'rgba(31,31,31,0.84)',
    overflow: 'hidden',
    borderRadius: 999,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
