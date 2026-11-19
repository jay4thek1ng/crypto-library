const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function isValidDeviceId(id: string): boolean {
  return DEVICE_RE.test(id);
}

/** Same shape as the web app: 18 random bytes, base64url, no padding. */
export function bytesToDeviceId(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = globalThis.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function newDeviceId(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  const id = bytesToDeviceId(bytes);
  if (!isValidDeviceId(id)) throw new Error('Could not create a device id');
  return id;
}
