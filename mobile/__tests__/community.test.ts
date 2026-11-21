import {
  COMMUNITY_ERROR_MESSAGE,
  COMMUNITY_OFFLINE_MESSAGE,
  parseCommunityRow,
  parseCommunityRows,
  resolveCommunityFailure,
  stripCommunityCovers,
} from '../src/lib/community';
import { ApiError, sbJSON } from '../src/lib/supabase';
import { bytesToDeviceId, isValidDeviceId } from '../src/lib/device';
import {
  friendlyUploadError,
  looksLikePdf,
  MAX_UPLOAD_BYTES,
  publicUploadBlock,
  quotaBlockReason,
  readUploadForm,
} from '../src/lib/upload';

const ROW = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  title: 'Hello',
  project: 'Proj',
  year: 2024,
  shelf: 'DF',
  description: 'About',
  storage_path: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf',
  size_bytes: 1000,
  cover: 'data:image/jpeg;base64,aaaa',
  page_count: 3,
  created_at: '2024-01-01T00:00:00Z',
};

describe('community papers', () => {
  it('mirrors the public storage URL and drops bad rows', () => {
    const item = parseCommunityRow(ROW, 'https://example.supabase.co/');
    expect(item?.id).toBe('c-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(item?.pdfUrl).toBe('https://example.supabase.co/storage/v1/object/public/papers/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf');
    expect(item?.shelf).toBe('CM');
    expect(item?.topic).toBe('DF');
    expect(item?.coverUri).toContain('data:image/jpeg');
    expect(parseCommunityRow({ ...ROW, storage_path: 'notes.pdf' }, 'https://example.supabase.co')).toBeNull();
    expect(parseCommunityRow({ ...ROW, cover: 'data:image/png;base64,aaaa' }, 'https://example.supabase.co')?.coverUri).toBeNull();
    expect(parseCommunityRows([ROW, ROW], 'https://example.supabase.co')).toHaveLength(1);
  });

  it('strips cover images before caching the list', () => {
    const [stripped] = stripCommunityCovers([ROW]) as Record<string, unknown>[];
    expect(stripped?.cover).toBeUndefined();
    expect(stripped?.title).toBe('Hello');
  });
});

describe('upload rules', () => {
  it('enforces the 25 MB cap and the same hourly and daily limits', () => {
    expect(publicUploadBlock(MAX_UPLOAD_BYTES)).toBeNull();
    expect(publicUploadBlock(MAX_UPLOAD_BYTES + 1)).toMatch(/25 MB/);
    expect(quotaBlockReason({ hour_left: 0, day_left: 4 })).toBe('RATE_LIMIT_HOUR');
    expect(quotaBlockReason({ hour_left: 1, day_left: 0 })).toBe('RATE_LIMIT_DAY');
    expect(quotaBlockReason({ hour_left: 2, day_left: 3 })).toBeNull();
    expect(friendlyUploadError('RATE_LIMIT_HOUR')).toMatch(/5 uploads per hour/);
    expect(friendlyUploadError('RATE_LIMIT_DAY')).toMatch(/20 uploads per day/);
    expect(looksLikePdf('%PDF-1.7 junk')).toBe(true);
    expect(looksLikePdf('hello')).toBe(false);
  });

  it('requires a title and project', () => {
    const ok = readUploadForm({ title: ' Paper ', project: 'Ethereum', year: '', shelf: 'L1', notes: 'hi', visibility: 'public' });
    expect(ok.ok && ok.value).toMatchObject({ title: 'Paper', project: 'Ethereum', year: null, shelf: 'L1', visibility: 'public' });
    expect(readUploadForm({ title: '', project: 'Ethereum', year: '', shelf: 'L1', notes: '', visibility: 'public' }).ok).toBe(false);
  });

  it('creates a device id the community API will accept', () => {
    const id = bytesToDeviceId(new Uint8Array(18).fill(7));
    expect(isValidDeviceId(id)).toBe(true);
  });
});

describe('community error handling', () => {
  it('shows Offline only when offline, and unreachable with retry on API/network failures while online', () => {
    expect(resolveCommunityFailure(new ApiError('Server Error', 500), false)).toEqual({
      status: 'error',
      message: COMMUNITY_ERROR_MESSAGE,
    });
    expect(resolveCommunityFailure(new ApiError('Server Error', 500), true)).toEqual({
      status: 'error',
      message: COMMUNITY_ERROR_MESSAGE,
    });
    expect(resolveCommunityFailure(new ApiError('NETWORK', 0), false)).toEqual({
      status: 'error',
      message: COMMUNITY_ERROR_MESSAGE,
    });
    expect(resolveCommunityFailure(new ApiError('NETWORK', 0), true)).toEqual({
      status: 'offline',
      message: COMMUNITY_OFFLINE_MESSAGE,
    });
  });

  it('logs a warning with URL and status when Supabase fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ message: 'Internal Error' }),
      }) as unknown as typeof fetch;
      await expect(sbJSON('GET', '/rest/v1/papers?limit=5')).rejects.toMatchObject({ status: 500 });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/rest/v1/papers?limit=5'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status=500'));

      warnSpy.mockClear();
      globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
      await expect(sbJSON('GET', '/rest/v1/papers?limit=5')).rejects.toMatchObject({ status: 0 });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/rest/v1/papers?limit=5'), expect.any(TypeError));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status=0'), expect.any(TypeError));
    } finally {
      globalThis.fetch = originalFetch;
      warnSpy.mockRestore();
    }
  });
});
