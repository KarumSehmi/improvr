import { createTheme, type MantineColorsTuple } from '@mantine/core';

const dark: MantineColorsTuple = [
  '#d5d5de',
  '#b6b6c2',
  '#8b8b99',
  '#5f5f6e',
  '#3b3b4a',
  '#2c2c39',
  '#20202b',
  '#16161e',
  '#101016',
  '#0a0a0f',
];

const font =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const theme = createTheme({
  primaryColor: 'violet',
  primaryShade: { light: 6, dark: 5 },
  colors: { dark },
  defaultRadius: 'lg',
  fontFamily: font,
  headings: { fontFamily: font, fontWeight: '800' },
  defaultGradient: { from: 'violet', to: 'pink', deg: 135 },
  components: {
    Card: { defaultProps: { withBorder: true, padding: 'md' } },
    Paper: { defaultProps: { withBorder: true } },
    Modal: { defaultProps: { centered: true, radius: 'lg' } },
    Button: { defaultProps: { radius: 'md' } },
  },
});
