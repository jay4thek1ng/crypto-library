import type { UploadShelf } from '../data/shelves';
import { isUploadShelf } from '../data/shelves';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface UploadDraft {
  title: string;
  project: string;
  year: number | null;
  shelf: UploadShelf;
  notes: string;
  visibility: 'public' | 'private';
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function looksLikePdf(header: string): boolean {
  return header.includes('%PDF');
}

export function publicUploadBlock(size: number): string | null {
  if (size > MAX_UPLOAD_BYTES) return 'That PDF is too large. Community uploads are limited to 25 MB.';
  return null;
}

export function quotaBlockReason(quota: { hour_left?: number; day_left?: number } | null): 'RATE_LIMIT_HOUR' | 'RATE_LIMIT_DAY' | null {
  if (quota && quota.hour_left === 0) return 'RATE_LIMIT_HOUR';
  if (quota && quota.day_left === 0) return 'RATE_LIMIT_DAY';
  return null;
}

export function friendlyUploadError(message: string, status?: number): string {
  if (message === 'NETWORK' || /network request failed|failed to fetch|internet/i.test(message)) {
    return "You're offline or the Community library can't be reached. Check your connection and try again.";
  }
  if (/RATE_LIMIT_HOUR/.test(message)) return 'Upload limit reached: at most 5 uploads per hour. Please try again later.';
  if (/RATE_LIMIT_DAY/.test(message)) return 'Upload limit reached: at most 20 uploads per day. Please try again tomorrow.';
  if (/TOO_LARGE|exceeded the maximum allowed size|Payload too large/i.test(message) || status === 413) {
    return 'That PDF is too large. Community uploads are limited to 25 MB.';
  }
  if (/NOT_PDF|mime type|invalid_mime/i.test(message) || status === 415) return 'Only PDF files can be uploaded.';
  if (/row-level security/i.test(message)) {
    return 'Uploads are paused for a moment because a lot of papers were shared recently. Please try again later.';
  }
  return `Upload failed: ${message}`;
}

export function friendlyReportError(message: string): string {
  if (message === 'NETWORK' || /network request failed|failed to fetch/i.test(message)) return "You're offline. Try again when you're connected.";
  if (/NOT_FOUND/.test(message)) return 'This upload was already removed.';
  if (/RATE_LIMIT/.test(message)) return 'Too many reports from this device. Try again later.';
  return `Couldn't send the report: ${message}`;
}

export function readUploadForm(input: {
  title: string;
  project: string;
  year: string;
  shelf: string;
  notes: string;
  visibility: string;
}): { ok: true; value: UploadDraft } | { ok: false; error: string } {
  const title = input.title.trim().slice(0, 200);
  const project = input.project.trim().slice(0, 100);
  if (!title || !project) return { ok: false, error: 'Title and project are required.' };
  if (!isUploadShelf(input.shelf)) return { ok: false, error: 'Choose a shelf.' };
  const parsed = Number.parseInt(input.year, 10);
  const year = parsed >= 1900 && parsed <= 2100 ? parsed : null;
  if (input.year.trim() && year == null) return { ok: false, error: 'Year must be between 1900 and 2100, or left blank.' };
  const visibility = input.visibility === 'public' ? 'public' : 'private';
  return {
    ok: true,
    value: { title, project, year, shelf: input.shelf, notes: input.notes.trim().slice(0, 1000), visibility },
  };
}

export function storageObjectName(id: string): string {
  return `${id}.pdf`;
}

export function nowMs(): number {
  return Date.now();
}
