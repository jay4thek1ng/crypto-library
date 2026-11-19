import backend from '../data/backend.json';

export const SUPABASE_URL = backend.supabaseUrl.replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = backend.supabaseAnonKey;
export const APP_VERSION = '2.0.0';
export const COMMUNITY_CACHE_KEY = 'cryptolib.community.v1';
