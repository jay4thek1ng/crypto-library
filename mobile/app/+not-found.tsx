import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';

export default function NotFound() {
  const router = useRouter();
  const colors = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>That page is not in the library.</Text>
      <Text style={[styles.link, { color: colors.accent2 }]} onPress={() => router.replace('/')}>Back to the library</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, marginBottom: 12 },
  link: { fontSize: 16, fontWeight: '600' },
});
