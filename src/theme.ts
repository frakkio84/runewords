import { Platform } from 'react-native';

export const colors = {
  bg: '#0c0a08',
  bgRaised: '#16110c',
  card: '#1c1510',
  cardBorder: '#3a2e1c',
  gold: '#c7a441',
  goldDim: '#8a732e',
  unique: '#c7b377',
  magic: '#8888ff',
  rune: '#c0b070',
  muted: '#9a8f7a',
  faint: '#6b5f4c',
  text: '#efe6d0',
  ladder: '#d4a017',
  nonLadder: '#7cb342',
  chip: '#241c14',
  chipActive: '#3d2f18',
  search: '#211a13',
};

export const fonts = {
  title: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia',
  }),
  body: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui',
  }),
};
