import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { isTopicKey, TOPICS } from '../src/data/shelves';
import type { UploadShelf } from '../src/data/shelves';
import { SUPABASE_URL } from '../src/lib/config';
import { useLibrary } from '../src/lib/library-context';
import { getPendingUpload, setPendingUpload } from '../src/lib/pending-upload';
import { ensureDownloaded, savePrivateFile } from '../src/lib/files';
import { ApiError, insertPaper, uploadPdfObject, uploadQuota } from '../src/lib/supabase';
import { formatBytes } from '../src/lib/offline-cache';
import {
  friendlyUploadError,
  looksLikePdf,
  nowMs,
  publicUploadBlock,
  quotaBlockReason,
  readUploadForm,
  storageObjectName,
  titleFromFileName,
} from '../src/lib/upload';
import { theme } from '../src/theme';

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const library = useLibrary();
  const pending = getPendingUpload();
  const [title, setTitle] = useState(pending ? titleFromFileName(pending.name) : '');
  const [project, setProject] = useState('');
  const [year, setYear] = useState('');
  const [shelf, setShelf] = useState<UploadShelf>('OT');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pending) {
      setStatus('Choose a PDF first.');
      return;
    }
    const form = readUploadForm({ title, project, year, shelf, notes, visibility });
    if (!form.ok) {
      setStatus(form.error);
      return;
    }
    setBusy(true);
    setStatus('Checking the PDF…');
    try {
      const header = await readHeader(pending.uri, pending.webFile);
      if (!looksLikePdf(header)) throw new Error('NOT_PDF');
      if (form.value.visibility === 'private') {
        const id = newPrivateId();
        await savePrivateFile(id, pending.uri);
        library.addPrivate({
          id,
          title: form.value.title,
          project: form.value.project,
          year: form.value.year,
          shelf: form.value.shelf === 'OT' ? 'UP' : form.value.shelf,
          notes: form.value.notes,
          fileName: pending.name,
          size: pending.size,
          added: nowMs(),
        });
        setPendingUpload(null);
        router.replace({ pathname: '/paper/[id]', params: { id } });
        return;
      }
      const tooBig = publicUploadBlock(pending.size);
      if (tooBig) throw new Error('TOO_LARGE');
      if (!library.deviceId) throw new Error('This device id is not ready yet. Try again in a moment.');
      setStatus('Checking your upload limit…');
      const quota = await uploadQuota(library.deviceId);
      const blocked = quotaBlockReason(quota);
      if (blocked) throw new Error(blocked);
      const objectName = storageObjectName(globalThis.crypto.randomUUID());
      setStatus('Uploading…');
      await uploadPdfObject(objectName, { uri: pending.uri, webFile: pending.webFile });
      setStatus('Publishing…');
      const paperId = await insertPaper({
        title: form.value.title,
        project: form.value.project,
        year: form.value.year,
        shelf: form.value.shelf === 'OT' ? 'OT' : form.value.shelf,
        description: form.value.notes || null,
        storage_path: objectName,
        size_bytes: pending.size,
        cover: null,
        page_count: null,
        uploader_id: library.deviceId,
      });
      try {
        const remote = `${SUPABASE_URL}/storage/v1/object/public/papers/${objectName}`;
        const saved = await ensureDownloaded(`c-${paperId}`, remote, 'pdf');
        library.noteCached(`c-${paperId}`, saved.bytes, 'pdf');
      } catch {
        // The public copy is already published. Offline cache is best-effort.
      }
      await library.refreshCommunity();
      setPendingUpload(null);
      router.replace({ pathname: '/paper/[id]', params: { id: `c-${paperId}` } });
    } catch (error) {
      const api = error instanceof Error ? error : new Error('Upload failed');
      setStatus(api.message === 'FILE_SYSTEM_WEB'
        ? 'Only-on-this-device copies are saved in the Android and iOS app.'
        : friendlyUploadError(api.message, error instanceof ApiError ? error.status : undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">‹ Library</Text>
      <Text style={styles.title}>Upload white paper</Text>
      <Text style={styles.file}>{pending ? `${pending.name} · ${pending.size ? formatBytes(pending.size) : 'size unknown'}` : 'No PDF selected.'}</Text>
      <Choice label="Share with everyone" detail="Adds it to the public Community shelf." selected={visibility === 'public'} onPress={() => setVisibility('public')} />
      <Choice label="Only on this device" detail="Private copy in My Uploads. Nothing leaves your phone." selected={visibility === 'private'} onPress={() => setVisibility('private')} />
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Project / blockchain" value={project} onChangeText={setProject} placeholder="e.g. Ethereum" />
      <Field label="Year" value={year} onChangeText={setYear} placeholder="e.g. 2024" keyboardType="number-pad" />
      <Text style={styles.label}>Shelf</Text>
      <View style={styles.shelves}>
        <Choice label="Other / no specific shelf" selected={shelf === 'OT'} onPress={() => setShelf('OT')} />
        {TOPICS.map((item) => <Choice key={item.key} label={item.label} selected={shelf === item.key} onPress={() => { if (isTopicKey(item.key)) setShelf(item.key); }} />)}
      </View>
      <Field label="Description (optional)" value={notes} onChangeText={setNotes} multiline />
      {visibility === 'public' ? <Text style={styles.note}>Uploads are public: anyone can read and download them. Only share papers that are already public or that you have the right to share. Max 25 MB. The owner removes reported or inappropriate uploads.</Text> : null}
      <Button label={busy ? 'Working…' : visibility === 'public' ? 'Upload' : 'Add to My Uploads'} kind="primary" disabled={busy || !pending} onPress={() => void submit()} />
      <Text style={styles.status} accessibilityRole="text">{status}</Text>
    </ScrollView>
  );
}

function newPrivateId(): string {
  return `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function readHeader(uri: string, webFile?: Blob): Promise<string> {
  if (webFile) return webFile.slice(0, 1024).text();
  const response = await fetch(uri);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return new TextDecoder().decode(bytes.slice(0, 1024));
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'number-pad'; multiline?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.text3} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.area]} />
    </View>
  );
}

function Choice({ label, detail, selected, onPress }: { label: string; detail?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}>
      <Text style={styles.choiceLabel}>{selected ? '● ' : '○ '}{label}</Text>
      {detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  back: { color: theme.accent2, fontSize: 17, paddingVertical: 8 },
  title: { color: theme.text, fontSize: 28, fontWeight: '700', marginBottom: 8 },
  file: { color: theme.text2, marginBottom: 12 },
  field: { marginBottom: 10 },
  label: { color: theme.text2, fontSize: 13, marginBottom: 4 },
  input: { backgroundColor: theme.fill, color: theme.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  area: { minHeight: 80, textAlignVertical: 'top' },
  shelves: { gap: 8, marginBottom: 12 },
  choice: { backgroundColor: theme.fill, borderRadius: 12, padding: 12, marginBottom: 8 },
  choiceOn: { backgroundColor: theme.paper },
  choiceLabel: { color: theme.text, fontSize: 15, fontWeight: '600' },
  choiceDetail: { color: theme.text2, fontSize: 13, marginTop: 3 },
  note: { color: theme.text, backgroundColor: 'rgba(100,210,255,0.12)', borderRadius: 10, padding: 12, marginBottom: 12, lineHeight: 19 },
  status: { color: theme.text2, marginTop: 12, minHeight: 20 },
});
