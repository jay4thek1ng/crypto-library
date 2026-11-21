import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { useLibrary } from '../../src/lib/library-context';
import { ApiError, sendReport } from '../../src/lib/supabase';
import { friendlyReportError } from '../../src/lib/upload';
import { useTheme } from '../../src/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function ReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = param(useLocalSearchParams<{ id: string }>().id);
  const library = useLibrary();
  const colors = useTheme();
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
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, backgroundColor: colors.bg }]}>
      <Text style={[styles.back, { color: colors.accent2 }]} onPress={() => router.back()} accessibilityRole="button">‹ Back</Text>
      <Text style={[styles.title, { color: colors.text }]}>{done ? 'Report sent' : 'Report this upload'}</Text>
      {item ? <Text style={[styles.paper, { color: colors.text2 }]}>“{item.title}”</Text> : <Text style={[styles.paper, { color: colors.text2 }]}>This paper is no longer in the library.</Text>}
      {done ? <Text style={[styles.body, { color: colors.text }]}>{done}</Text> : (
        <>
          <Text style={[styles.body, { color: colors.text }]}>Report spam, offensive content, malware, copyright problems or anything that is not a crypto white paper. Uploads with several reports are hidden automatically and the owner reviews them.</Text>
          <Text style={[styles.label, { color: colors.text2 }]}>Reason (optional)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            placeholder="What is wrong with it?"
            placeholderTextColor={colors.text3}
            selectionColor={colors.accent}
            keyboardAppearance={colors.mode}
            style={[styles.input, { backgroundColor: colors.paper, color: colors.text, borderColor: colors.pillBorder }]}
          />
          <Button label={busy ? 'Sending…' : 'Send report'} kind="danger" disabled={busy || !item?.communityId} onPress={() => void submit()} />
        </>
      )}
      <Text style={[styles.status, { color: colors.text2 }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { fontSize: 17, fontWeight: '600', paddingVertical: 8 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  paper: { marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 21, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { borderRadius: 12, borderWidth: 1, minHeight: 90, padding: 12, fontSize: 16, textAlignVertical: 'top', marginBottom: 12 },
  status: { marginTop: 12 },
});
