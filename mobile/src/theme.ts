import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import type { ShelfKey } from './data/shelves';
import type { AppearanceMode, ReaderThemeMode } from './lib/storage';

export interface ThemeColors {
  mode: 'light' | 'dark';
  barStyle: 'dark' | 'light';
  bg: string;
  paper: string;
  text: string;
  text2: string;
  text3: string;
  line: string;
  pillBorder: string;
  fill: string;
  accent: string;
  accent2: string;
  accentOnFill: string;
  accentSoft: string;
  danger: string;
  reader: string;
  white: string;
  shadow: string;
  bannerOfflineBg: string;
  bannerOfflineBorder: string;
  bannerOfflineText: string;
  bannerErrorBg: string;
  bannerErrorBorder: string;
  bannerErrorText: string;
}

export const LIGHT_THEME: ThemeColors = {
  mode: 'light',
  barStyle: 'dark',
  bg: '#FAF7F2',
  paper: '#FFFFFF',
  text: '#1F1F1F',
  text2: '#52555A',
  text3: '#5F6368',
  line: '#DDD7CC',
  pillBorder: '#8B867D',
  fill: '#EFEAE1',
  accent: '#1D4ED8',
  accent2: '#1D4ED8',
  accentOnFill: '#FFFFFF',
  accentSoft: '#E8EEFC',
  danger: '#B91C1C',
  reader: '#E9E6E0',
  white: '#FFFFFF',
  shadow: '#1F1F1F',
  bannerOfflineBg: '#FDF3DC',
  bannerOfflineBorder: '#9A6700',
  bannerOfflineText: '#6B4500',
  bannerErrorBg: '#FCEAEA',
  bannerErrorBorder: '#B91C1C',
  bannerErrorText: '#8E1515',
};

export const DARK_THEME: ThemeColors = {
  mode: 'dark',
  barStyle: 'light',
  bg: '#000000',
  paper: '#1C1C1E',
  text: '#F2F2F7',
  text2: '#AEAEB2',
  text3: '#8E8E93',
  line: '#38383A',
  pillBorder: '#7C7C82',
  fill: '#2C2C2E',
  accent: '#FF9F0A',
  accent2: '#64D2FF',
  accentOnFill: '#1C1C1E',
  accentSoft: 'rgba(100,210,255,0.14)',
  danger: '#FF453A',
  reader: '#525659',
  white: '#FFFFFF',
  shadow: '#000000',
  bannerOfflineBg: '#261E0C',
  bannerOfflineBorder: '#D4941A',
  bannerOfflineText: '#FFD27D',
  bannerErrorBg: '#2B1414',
  bannerErrorBorder: '#FF6B63',
  bannerErrorText: '#FF9E99',
};

export interface ReaderThemeTokens {
  key: ReaderThemeMode;
  label: string;
  barStyle: 'dark' | 'light';
  canvas: string;
  pageBg: string;
  chromeBg: string;
  chromeBorder: string;
  text: string;
  text2: string;
  accent: string;
  pillBg: string;
  pillBorder: string;
  activeFill: string;
  activeText: string;
  bookmark: string;
}

export const READER_THEMES: Record<ReaderThemeMode, ReaderThemeTokens> = {
  white: {
    key: 'white',
    label: 'White',
    barStyle: 'dark',
    canvas: '#E9E6E0',
    pageBg: '#FFFFFF',
    chromeBg: '#FAF7F2',
    chromeBorder: '#DDD7CC',
    text: '#1F1F1F',
    text2: '#52555A',
    accent: '#1D4ED8',
    pillBg: '#EFEAE1',
    pillBorder: '#8B867D',
    activeFill: '#1D4ED8',
    activeText: '#FFFFFF',
    bookmark: '#1D4ED8',
  },
  sepia: {
    key: 'sepia',
    label: 'Sepia',
    barStyle: 'dark',
    canvas: '#E5DAC3',
    pageBg: '#FBF4E4',
    chromeBg: '#F4EBD7',
    chromeBorder: '#CFC1A5',
    text: '#2B2216',
    text2: '#5D4E3B',
    accent: '#1D4ED8',
    pillBg: '#EAE0C9',
    pillBorder: '#877961',
    activeFill: '#1D4ED8',
    activeText: '#FFFFFF',
    bookmark: '#1D4ED8',
  },
  dark: {
    key: 'dark',
    label: 'Dark',
    barStyle: 'light',
    canvas: '#141416',
    pageBg: '#1C1C1E',
    chromeBg: '#1C1C1E',
    chromeBorder: '#38383A',
    text: '#F2F2F7',
    text2: '#AEAEB2',
    accent: '#64D2FF',
    pillBg: '#2C2C2E',
    pillBorder: '#7C7C82',
    activeFill: '#64D2FF',
    activeText: '#1C1C1E',
    bookmark: '#FF9F0A',
  },
};

export const SHELF_TINTS: Record<ShelfKey, { bg: string; border: string }> = {
  L1: { bg: '#E7ECFC', border: '#8B867D' },
  L2: { bg: '#FCEBE6', border: '#8B867D' },
  DF: { bg: '#FAE8F1', border: '#8B867D' },
  SC: { bg: '#E4F4EC', border: '#8B867D' },
  OR: { bg: '#E3F2F8', border: '#8B867D' },
  ST: { bg: '#E4F3EF', border: '#8B867D' },
  PR: { bg: '#EDEAF5', border: '#8B867D' },
  SOL: { bg: '#EFE8FC', border: '#8B867D' },
  AI: { bg: '#FDF1DE', border: '#8B867D' },
  CR: { bg: '#E6ECF2', border: '#8B867D' },
  CM: { bg: '#E5F1FC', border: '#8B867D' },
  UP: { bg: '#ECEBFA', border: '#8B867D' },
};

export function resolveTheme(appearance: AppearanceMode, systemScheme: 'light' | 'dark' | null | undefined): ThemeColors {
  if (appearance === 'dark') return DARK_THEME;
  if (appearance === 'light') return LIGHT_THEME;
  return systemScheme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export const AppearanceContext = createContext<AppearanceMode>('light');

export function useTheme(): ThemeColors {
  const appearance = useContext(AppearanceContext);
  const systemScheme = useColorScheme();
  return resolveTheme(appearance, systemScheme);
}

export const theme = LIGHT_THEME;
