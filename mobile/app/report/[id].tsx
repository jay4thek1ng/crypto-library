import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { useLibrary } from '../../src/lib/library-context';
import { ApiError, sendReport } from '../../src/lib/supabase';
import { friendlyReportError } from '../../src/lib/upload';
import { theme } from '../../src/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function ReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = param(useLocalSearchParams<{ id: string }>().id);
  const library = useLibrary();
  const item = library.find(id);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  async function submit() {
    if (!item?.communityId) {
      setStatus('Only community uploads can be reported.');
      return;
    }
    if (!library.deviceId) {
      setStatus('This device id is not ready yet.');
      return;
    }
    setBusy(true);
    setStatus('Sending…');
    try {
      const result = await sendReport(item.communityId, library.deviceId, reason.trim().slice(0, 500) || null);
      library.markReported(item.communityId);
      setDone(result === 'dup' ? "You've already reported this upload." : 'The owner will review it. Uploads with several reports are hidden for everyone automatically.');
      setStatus('');
      void library.refreshCommunity();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send the report.';
      setStatus(friendlyReportError(message === 'NETWORK' || error instanceof ApiError ? message : message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingHorizontal: 20 }]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">‹ Back</Text>
      <Text style={styles.title}>{done ? 'Report sent' : 'Report this upload'}</Text>
      {item ? <Text style={styles.paper}>“{item.title}”</Text> : <Text style={styles.paper}>This paper is no longer in the library.</Text>}
      {done ? <Text style={styles.body}>{done}</Text> : (
        <>
          <Text style={styles.body}>Report spam, offensive content, malware, copyright problems or anything that is not a crypto white paper. Uploads with several reports are hidden automatically and the owner reviews them.</Text>
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="What is wrong with it?" placeholderTextColor={theme.text3} style={styles.input} />
          <Button label={busy ? 'Sending…' : 'Send report'} kind="danger" disabled={busy || !item?.communityId} onPress={() => void submit()} />
        </>
      )}
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  back: { color: theme.accent2, fontSize: 17, paddingVertical: 8 },
  title: { color: theme.text, fontSize: 28, fontWeight: '700', marginBottom: 8 },
  paper: { color: theme.text2, marginBottom: 12 },
  body: { color: theme.text, fontSize: 15, lineHeight: 21, marginBottom: 14 },
  label: { color: theme.text2, fontSize: 13, marginBottom: 4 },
  input: { backgroundColor: theme.fill, color: theme.text, borderRadius: 10, minHeight: 90, padding: 12, fontSize: 16, textAlignVertical: 'top', marginBottom: 12 },
  status: { color: theme.text2, marginTop: 12 },
});
