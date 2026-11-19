import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Kv } from './storage';

export const asyncKv: Kv = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
