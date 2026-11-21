declare module '*.webp' {
  const value: number;
  export default value;
}

declare module '*.mjs' {
  const value: number;
  export default value;
}

declare module '*.html' {
  const value: number;
  export default value;
}

declare module '*.pfb' {
  const value: number;
  export default value;
}

declare module '*.bcmap' {
  const value: number;
  export default value;
}

declare module '*.ttf' {
  const value: number;
  export default value;
}

declare module 'react-native-web' {
  import type { ReactElement, Ref } from 'react';
  export function unstable_createElement(
    type: string,
    props: { ref?: Ref<HTMLIFrameElement | null>; style?: object; src?: string; title?: string },
  ): ReactElement;
}
