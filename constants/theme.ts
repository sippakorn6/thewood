import { Platform } from 'react-native';

// The Wood (light wood minimal)
const woodDark = '#8B6B4F';
const wood = '#C8A47E';
const bg = '#F7F1E6';
const card = '#FFF8EE';
const border = '#E6D6C3';
const text = '#2B1E14';
const muted = '#6B4E3B';

const tintColorLight = woodDark;
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text,
    background: bg,
    tint: tintColorLight,
    icon: muted,
    tabIconDefault: muted,
    tabIconSelected: tintColorLight,
    card,
    border,
    wood,
    woodDark,
    muted,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    card: '#1E1F20',
    border: '#2A2B2C',
    wood,
    woodDark,
    muted: '#9BA1A6',
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Menlo',
  },
  android: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});
