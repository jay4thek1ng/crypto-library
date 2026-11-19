import { forwardRef, useImperativeHandle, useRef, type ComponentType, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import type { PdfFrameHandle, PdfFrameProps } from './pdf-frame';

interface WebViewProps {
  ref?: Ref<WebViewHandle>;
  source: { uri: string };
  style?: object;
  originWhitelist?: string[];
  allowFileAccess?: boolean;
  allowUniversalAccessFromFileURLs?: boolean;
  allowingReadAccessToURL?: string;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  mixedContentMode?: 'never' | 'always' | 'compatibility';
  setSupportMultipleWindows?: boolean;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
}

interface WebViewHandle {
  injectJavaScript: (script: string) => void;
}

const Browser = WebView as unknown as ComponentType<WebViewProps>;

export const PdfFrame = forwardRef<PdfFrameHandle, PdfFrameProps>(function PdfFrame({ uri, onMessage, readAccessUrl }, ref) {
  const webRef = useRef<WebViewHandle>(null);
  useImperativeHandle(ref, () => ({
    setPage(page: number) {
      webRef.current?.injectJavaScript(`window.reader && window.reader.setPage(${page}); true;`);
    },
    setZoom(zoom: number) {
      webRef.current?.injectJavaScript(`window.reader && window.reader.setZoom(${zoom}); true;`);
    },
  }));
  return (
    <Browser
      ref={webRef}
      source={{ uri }}
      style={styles.web}
      originWhitelist={['*']}
      allowFileAccess
      allowUniversalAccessFromFileURLs
      allowingReadAccessToURL={readAccessUrl}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      setSupportMultipleWindows={false}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
    />
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#525659' },
});
