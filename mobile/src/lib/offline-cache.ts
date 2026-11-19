export interface CacheRecord {
  id: string;
  bytes: number;
  fileName: string;
}

export function paperFileName(id: string, extension = 'pdf'): string {
  const ext = extension.replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'pdf';
  const safe = id.replace(/[^A-Za-z0-9-]/g, '_').replace(/^_+/, '').slice(0, 80);
  if (!safe) return `paper.${ext}`;
  return `${safe}.${ext}`;
}

export function isSafePaperFileName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.(pdf|html|htm)$/.test(name) && !name.includes('..');
}

export function idFromPaperFileName(name: string): string | null {
  if (!isSafePaperFileName(name)) return null;
  return name.replace(/\.(pdf|html|htm)$/i, '');
}

export function totalCacheBytes(records: readonly CacheRecord[]): number {
  return records.reduce((sum, record) => sum + (Number.isFinite(record.bytes) && record.bytes > 0 ? record.bytes : 0), 0);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function upsertCacheRecord(records: readonly CacheRecord[], next: CacheRecord): CacheRecord[] {
  return [...records.filter((record) => record.id !== next.id), next];
}

export function removeCacheRecord(records: readonly CacheRecord[], id: string): CacheRecord[] {
  return records.filter((record) => record.id !== id);
}

export function findCacheRecord(records: readonly CacheRecord[], id: string): CacheRecord | null {
  return records.find((record) => record.id === id) ?? null;
}

/** Prefer the on-device file once a paper has been saved. Otherwise use the remote URL. */
export function resolvePdfSource(localUri: string | null | undefined, remoteUrl: string | null | undefined): string | null {
  if (localUri) return localUri;
  if (remoteUrl) return remoteUrl;
  return null;
}

export function buildReaderUrl(readerBase: string, fileUrl: string, page: number): string {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const join = readerBase.includes('?') ? '&' : '?';
  return `${readerBase}${join}file=${encodeURIComponent(fileUrl)}&page=${safePage}`;
}
