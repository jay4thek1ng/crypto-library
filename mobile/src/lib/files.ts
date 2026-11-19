import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { CacheRecord } from './offline-cache';
import { idFromPaperFileName, paperFileName } from './offline-cache';

const PAPERS = 'papers';
const PRIVATE = 'private';

function ensureDir(name: string): Directory {
  const dir = new Directory(Paths.document, name);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function supportsFileCache(): boolean {
  return Platform.OS !== 'web';
}

export async function localPaperUri(id: string, extension = 'pdf'): Promise<string | null> {
  if (!supportsFileCache()) return null;
  const file = new File(Paths.document, PAPERS, paperFileName(id, extension));
  if (file.exists && file.size > 0) return file.uri;
  return null;
}

export async function privateFileUri(id: string): Promise<string | null> {
  if (!supportsFileCache()) return null;
  const file = new File(Paths.document, PRIVATE, paperFileName(id, 'pdf'));
  if (file.exists && file.size > 0) return file.uri;
  return null;
}

export async function ensureDownloaded(id: string, remoteUrl: string, extension = 'pdf'): Promise<{ uri: string; bytes: number }> {
  if (!supportsFileCache()) throw new Error('FILE_SYSTEM_WEB');
  const dest = new File(ensureDir(PAPERS), paperFileName(id, extension));
  if (dest.exists && dest.size > 0) return { uri: dest.uri, bytes: dest.size };
  const file = await File.downloadFileAsync(remoteUrl, dest, { idempotent: true });
  return { uri: file.uri, bytes: file.size };
}

export async function savePrivateFile(id: string, fromUri: string): Promise<{ uri: string; bytes: number }> {
  if (!supportsFileCache()) throw new Error('FILE_SYSTEM_WEB');
  const dest = new File(ensureDir(PRIVATE), paperFileName(id, 'pdf'));
  await new File(fromUri).copy(dest, { overwrite: true });
  return { uri: dest.uri, bytes: dest.size };
}

export async function measureDownloads(): Promise<CacheRecord[]> {
  if (!supportsFileCache()) return [];
  const dir = new Directory(Paths.document, PAPERS);
  if (!dir.exists) return [];
  const records: CacheRecord[] = [];
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue;
    const id = idFromPaperFileName(entry.name);
    if (!id || entry.size <= 0) continue;
    records.push({ id, bytes: entry.size, fileName: entry.name });
  }
  return records;
}

export async function clearDownloadedFiles(): Promise<void> {
  if (!supportsFileCache()) return;
  const dir = new Directory(Paths.document, PAPERS);
  if (!dir.exists) return;
  for (const entry of dir.list()) entry.delete();
}
