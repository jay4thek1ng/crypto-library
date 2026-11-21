import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { LibraryProvider, useLibrary } from '../src/lib/library-context';
import { useTheme } from '../src/theme';

void SplashScreen.preventAutoHideAsync();

function SplashGate({ children }: { children: ReactNode }) {
  const library = useLibrary();
  useEffect(() => {
    if (library.ready) void SplashScreen.hideAsync();
  }, [library.ready]);
  return children;
}

function ThemedShell() {
  const colors = useTheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SplashGate>
        <StatusBar style={colors.barStyle} />
        <NavigationBar style={colors.barStyle} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            navigationBarColor: colors.bg,
            statusBarStyle: colors.barStyle,
            animation: 'slide_from_right',
          }}
        />
      </SplashGate>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LibraryProvider>
        <ThemedShell />
      </LibraryProvider>
    </SafeAreaProvider>
  );
}
