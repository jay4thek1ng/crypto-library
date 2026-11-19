import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { READER_FILES } from '../data/reader-assets';

let prepared: Promise<string> | null = null;

async function copyReader(): Promise<string> {
  const root = new Directory(Paths.document, 'reader');
  if (!root.exists) root.create({ intermediates: true, idempotent: true });
  for (const entry of READER_FILES) {
    const asset = Asset.fromModule(entry.moduleId);
    if (!asset.localUri) await asset.downloadAsync();
    const localUri = asset.localUri;
    if (!localUri) throw new Error(`Missing reader asset ${entry.path}`);
    const parts = entry.path.split('/');
    const fileName = parts.pop();
    if (!fileName) continue;
    let dir = root;
    for (const part of parts) {
      dir = new Directory(dir, part);
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    }
    const dest = new File(dir, fileName);
    if (fileName === 'index.html' || !dest.exists) {
      await new File(localUri).copy(dest, { overwrite: true });
    }
  }
  return new File(root, 'index.html').uri;
}

export function prepareReaderBase(): Promise<string> {
  if (Platform.OS === 'web') return Promise.resolve('/reader/index.html');
  prepared ??= copyReader();
  return prepared;
}

export function readerReadAccessUrl(): string | undefined {
  if (Platform.OS === 'web') return undefined;
  return Paths.document.uri;
}
