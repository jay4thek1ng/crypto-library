import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { unstable_createElement as createElement } from 'react-native-web';
import type { PdfFrameHandle, PdfFrameProps } from './pdf-frame';

interface ReaderWindow extends Window {
  reader?: {
    setPage: (page: number) => void;
    setZoom: (zoom: number) => void;
  };
}

export const PdfFrame = forwardRef<PdfFrameHandle, PdfFrameProps>(function PdfFrame({ uri, onMessage }, ref) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  useImperativeHandle(ref, () => ({
    setPage(page: number) {
      frameRef.current?.contentWindow?.reader?.setPage(page);
    },
    setZoom(zoom: number) {
      frameRef.current?.contentWindow?.reader?.setZoom(zoom);
    },
  }));
  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (typeof event.data === 'string') onMessage(event.data);
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [onMessage]);
  return (
    <View style={styles.box}>
      {createElement('iframe', {
        ref: frameRef,
        src: uri,
        title: 'Paper',
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', backgroundColor: '#525659' },
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { flex: 1, position: 'relative', backgroundColor: '#525659', minHeight: 240 },
});

declare global {
  interface Window {
    reader?: ReaderWindow['reader'];
  }
}
