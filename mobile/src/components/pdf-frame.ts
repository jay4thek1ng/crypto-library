export interface PdfFrameHandle {
  setPage: (page: number) => void;
  setZoom: (zoom: number) => void;
}

export interface PdfFrameProps {
  uri: string;
  onMessage: (data: string) => void;
  readAccessUrl?: string;
}
