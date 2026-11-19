import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { LibraryProvider, useLibrary } from '../src/lib/library-context';
import { theme } from '../src/theme';

void SplashScreen.preventAutoHideAsync();

function SplashGate({ children }: { children: ReactNode }) {
  const library = useLibrary();
  useEffect(() => {
    if (library.ready) void SplashScreen.hideAsync();
  }, [library.ready]);
  return children;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaProvider>
        <LibraryProvider>
          <SplashGate>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.bg },
                animation: 'slide_from_right',
              }}
            />
          </SplashGate>
        </LibraryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
