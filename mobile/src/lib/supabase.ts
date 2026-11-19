import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { COMMUNITY_COLUMNS } from './community';

export function supabaseHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { apikey: key, ...extra };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function sbJSON(method: string, path: string, body?: unknown, prefer = 'return=minimal'): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}${path}`, {
      method,
      headers: supabaseHeaders(SUPABASE_ANON_KEY, {
        'Content-Type': 'application/json',
        Prefer: prefer,
      }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK', 0);
  }
  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }
  if (!response.ok) {
    const record = json && typeof json === 'object' ? (json as { message?: string; error?: string }) : null;
    throw new ApiError(record?.message || record?.error || `HTTP ${response.status}`, response.status);
  }
  return json;
}

export async function listCommunityPapers(): Promise<unknown[]> {
  const rows = await sbJSON('GET', `/rest/v1/papers?select=${COMMUNITY_COLUMNS}&order=created_at.desc&limit=500`);
  return Array.isArray(rows) ? rows : [];
}

export async function uploadQuota(uploader: string): Promise<{ hour_left?: number; day_left?: number }> {
  const result = await sbJSON('POST', '/rest/v1/rpc/upload_quota', { p_uploader: uploader }, 'return=representation');
  if (result && typeof result === 'object') return result as { hour_left?: number; day_left?: number };
  return {};
}

export async function insertPaper(row: Record<string, unknown>): Promise<string> {
  const result = await sbJSON('POST', '/rest/v1/papers?select=id', row, 'return=representation');
  const first = Array.isArray(result) ? result[0] : null;
  if (first && typeof first === 'object' && typeof (first as { id?: unknown }).id === 'string') return (first as { id: string }).id;
  throw new ApiError('Upload finished but the new paper id was missing.', 500);
}

export async function sendReport(paperId: string, reporterId: string, reason: string | null): Promise<'ok' | 'dup'> {
  try {
    await sbJSON('POST', '/rest/v1/reports', { paper_id: paperId, reporter_id: reporterId, reason });
    return 'ok';
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return 'dup';
    throw error;
  }
}

export async function uploadPdfObject(name: string, source: { uri: string; webFile?: Blob }): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/papers/${name}`;
  const headers = supabaseHeaders(SUPABASE_ANON_KEY, {
    'Content-Type': 'application/pdf',
    'x-upsert': 'false',
  });
  if (Platform.OS === 'web') {
    const body = source.webFile ?? (await (await fetch(source.uri)).blob());
    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body });
    } catch {
      throw new ApiError('NETWORK', 0);
    }
    if (!response.ok) {
      const text = await response.text();
      let message = `HTTP ${response.status}`;
      try {
        const json = JSON.parse(text) as { message?: string; error?: string };
        message = json.message || json.error || message;
      } catch {
        if (text) message = text.slice(0, 300);
      }
      throw new ApiError(message, response.status);
    }
    return;
  }
  const result = await new File(source.uri).upload(url, {
    httpMethod: 'POST',
    uploadType: UploadType.BINARY_CONTENT,
    headers,
  });
  if (result.status < 200 || result.status >= 300) {
    let message = `HTTP ${result.status}`;
    try {
      const json = JSON.parse(result.body) as { message?: string; error?: string };
      message = json.message || json.error || message;
    } catch {
      if (result.body) message = result.body.slice(0, 300);
    }
    throw new ApiError(message, result.status);
  }
}
