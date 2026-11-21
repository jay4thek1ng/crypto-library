import { SHELF_KEYS } from '../src/data/shelves';
import {
  contrastRatio,
  DARK_THEME,
  LIGHT_THEME,
  READER_THEMES,
  resolveTheme,
  SHELF_TINTS,
} from '../src/theme';

describe('theme contrast and resolution', () => {
  it('resolves light as default and switches cleanly for system and dark', () => {
    expect(resolveTheme('light', 'dark')).toBe(LIGHT_THEME);
    expect(resolveTheme('dark', 'light')).toBe(DARK_THEME);
    expect(resolveTheme('system', 'dark')).toBe(DARK_THEME);
    expect(resolveTheme('system', 'light')).toBe(LIGHT_THEME);
    expect(resolveTheme('system', null)).toBe(LIGHT_THEME);
  });

  it('meets WCAG AA contrast across light theme text, accents, pill borders, and banners', () => {
    expect(LIGHT_THEME.text).not.toBe('#000000');
    expect(contrastRatio(LIGHT_THEME.text, LIGHT_THEME.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.text, LIGHT_THEME.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.text, LIGHT_THEME.fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.text2, LIGHT_THEME.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.text2, LIGHT_THEME.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.text3, LIGHT_THEME.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.text3, LIGHT_THEME.fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.accent, LIGHT_THEME.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.accent, LIGHT_THEME.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.accentOnFill, LIGHT_THEME.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.danger, LIGHT_THEME.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.pillBorder, LIGHT_THEME.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(LIGHT_THEME.pillBorder, LIGHT_THEME.fill)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(LIGHT_THEME.bannerOfflineBorder, LIGHT_THEME.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(LIGHT_THEME.bannerOfflineText, LIGHT_THEME.bannerOfflineBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_THEME.bannerErrorBorder, LIGHT_THEME.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(LIGHT_THEME.bannerErrorText, LIGHT_THEME.bannerErrorBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('meets WCAG AA contrast across dark theme, reader themes, and shelf tints', () => {
    expect(contrastRatio(DARK_THEME.text, DARK_THEME.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_THEME.text2, DARK_THEME.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_THEME.accent2, DARK_THEME.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_THEME.accentOnFill, DARK_THEME.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_THEME.pillBorder, DARK_THEME.fill)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(DARK_THEME.bannerOfflineText, DARK_THEME.bannerOfflineBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_THEME.bannerErrorText, DARK_THEME.bannerErrorBg)).toBeGreaterThanOrEqual(4.5);

    for (const reader of Object.values(READER_THEMES)) {
      expect(contrastRatio(reader.text, reader.chromeBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(reader.text2, reader.chromeBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(reader.accent, reader.chromeBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(reader.activeText, reader.activeFill)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(reader.pillBorder, reader.pillBg)).toBeGreaterThanOrEqual(3);
    }

    for (const key of SHELF_KEYS) {
      expect(contrastRatio(LIGHT_THEME.text, SHELF_TINTS[key].bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
