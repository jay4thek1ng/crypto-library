export interface PendingUpload {
  uri: string;
  name: string;
  size: number;
  mimeType?: string;
  webFile?: Blob;
}

let pending: PendingUpload | null = null;

export function setPendingUpload(value: PendingUpload | null): void {
  pending = value;
}

export function getPendingUpload(): PendingUpload | null {
  return pending;
}
