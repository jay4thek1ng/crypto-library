import type { ReaderThemeMode } from '../lib/storage';

export interface PdfFrameHandle {
  setPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  setTheme: (theme: ReaderThemeMode) => void;
}

export interface PdfFrameProps {
  uri: string;
  onMessage: (data: string) => void;
  readAccessUrl?: string;
  backgroundColor?: string;
}
