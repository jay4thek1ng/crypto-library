# Crypto White Paper Digital Book

Native Expo app for the Crypto White Paper library. It reads the same catalog, covers, and public Supabase project as the web app at the repository root. It does not bundle the PDFs.

- Display name: Crypto White Paper Digital Book
- Version: 2.0.0
- Android `versionCode`: 3
- Android package and iOS bundle id: `io.github.jay4thek1ng.cryptolibrary`

## Run

```bash
cd mobile
npm install
npm run catalog   # refresh catalog, covers, and the PDF.js reader from the web app
npx expo start
```

- Android: `npm run android`, or scan the QR code with Expo Go.
- iOS: `npm run ios` on a Mac, or Expo Go.
- Web preview: `npm run web`.

`npm run catalog` is safe to re-run. It reads `../data.js`, `../config.js`, `../covers`, and `../pdfjs` and writes `src/data/` plus `assets/covers` and `assets/reader`. It refuses to copy a Supabase key whose JWT role is not `anon`.

## Test

```bash
npm run typecheck
npm run lint
npm test
npm run export:web
```

`npm run typecheck` is `tsc --noEmit`. Tests cover catalog parsing, search, bookmarks and reading progress, and the offline-cache helpers.

## PDF reader

The reader is a `react-native-webview` page that runs the same Mozilla PDF.js build the website vendors (`assets/reader`, Apache-2.0). The shell passes the file URL and the resume page. PDF.js draws the pages, reports the visible page, and accepts page-jump and zoom commands.

`react-native-pdf` was not used. It needs a custom native module, so it does not run in Expo Go. WebView and PDF.js do: Expo Go, a dev build, and the web export all use the same reader. On Android and iOS, opening a PDF saves it with `expo-file-system` under the app documents directory and the next open uses that file, including offline. The web export has no device file system, so it reads the hosted URL directly. Settings shows how much space the saved files use and can clear them.

## Build

`eas.json` has three profiles:

- `development`: dev client, internal distribution, Android APK
- `preview`: internal distribution, Android APK
- `production`: Android App Bundle

Do not run a build until an Expo account is logged in. No upload keystore is in this repo. The existing APK keystore is held separately and should be supplied to EAS when you are ready to replace the current app in place. Do not generate a new keystore for this package id.

Before the first `development` build, install the dev client: `npx expo install expo-dev-client`. Expo Go does not need it.

```bash
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```

`appVersionSource` is `local`, so EAS uses the `version` and `versionCode` in `app.json`.
