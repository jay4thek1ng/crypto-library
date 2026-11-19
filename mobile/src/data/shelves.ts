export const SHELF_KEYS = ['L1', 'L2', 'DF', 'SC', 'OR', 'ST', 'PR', 'SOL', 'AI', 'CR', 'CM', 'UP'] as const;

export type ShelfKey = (typeof SHELF_KEYS)[number];
export type TopicKey = Exclude<ShelfKey, 'CM' | 'UP'>;
export type UploadShelf = TopicKey | 'OT';

export interface Shelf {
  key: ShelfKey;
  label: string;
  from: string;
  to: string;
}

export const SHELVES: Record<ShelfKey, Shelf> = {
  L1: { key: 'L1', label: 'Layer 1s', from: '#2F5BFF', to: '#7B3CFF' },
  L2: { key: 'L2', label: 'Layer 2s & Scaling', from: '#FF6A3D', to: '#E0245E' },
  DF: { key: 'DF', label: 'DeFi', from: '#E5267A', to: '#7A2BD9' },
  SC: { key: 'SC', label: 'Stablecoins', from: '#10915A', to: '#2C6E49' },
  OR: { key: 'OR', label: 'Oracles & Infra', from: '#0088D1', to: '#00A896' },
  ST: { key: 'ST', label: 'Storage', from: '#1E8C6E', to: '#0B4F6C' },
  PR: { key: 'PR', label: 'Privacy', from: '#3A3550', to: '#6A2C91' },
  SOL: { key: 'SOL', label: 'Solana Ecosystem', from: '#8A3FFC', to: '#0FAF7F' },
  AI: { key: 'AI', label: 'AI & DePIN', from: '#E08A00', to: '#D6453D' },
  CR: { key: 'CR', label: 'Cryptography & Consensus', from: '#17263A', to: '#2E5E7E' },
  CM: { key: 'CM', label: 'Community', from: '#0A84FF', to: '#13A89E' },
  UP: { key: 'UP', label: 'My Uploads', from: '#5856D6', to: '#C2389B' },
};

export const TOPICS: Shelf[] = SHELF_KEYS.filter((key): key is TopicKey => key !== 'CM' && key !== 'UP').map((key) => SHELVES[key]);

export const SHELF_ORDER: Shelf[] = [SHELVES.CM, SHELVES.UP, ...TOPICS];

const SHELF_SET = new Set<string>(SHELF_KEYS);
const TOPIC_SET = new Set<string>(TOPICS.map((shelf) => shelf.key));

export function isShelfKey(value: unknown): value is ShelfKey {
  return typeof value === 'string' && SHELF_SET.has(value);
}

export function isTopicKey(value: unknown): value is TopicKey {
  return typeof value === 'string' && TOPIC_SET.has(value);
}

export function isUploadShelf(value: unknown): value is UploadShelf {
  return value === 'OT' || isTopicKey(value);
}
