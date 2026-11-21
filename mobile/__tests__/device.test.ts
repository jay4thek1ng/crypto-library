import { isValidDeviceId, newDeviceId } from '../src/lib/device';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256),
}));

describe('newDeviceId', () => {
  it('works without Web Crypto, as on Hermes', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const id = newDeviceId();
      expect(isValidDeviceId(id)).toBe(true);
      expect(id).toHaveLength(24);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});
