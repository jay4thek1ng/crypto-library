import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../src/theme';

export default function NotFound() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>That page is not in the library.</Text>
      <Text style={styles.link} onPress={() => router.replace('/')}>Back to the library</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: theme.text, fontSize: 18, marginBottom: 12 },
  link: { color: theme.accent2, fontSize: 16 },
});
