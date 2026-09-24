import { createTheme, type MantineColorsTuple } from '@mantine/core';

const dark: MantineColorsTuple = [
  '#dcdce6',
  '#b9b9c8',
  '#8e8ea3',
  '#62627a',
  '#34344a',
  '#262636',
  '#1a1a26',
  '#0f0f17',
  '#0a0a10',
  '#06060a',
];

const font =
  '"Plus Jakarta Sans Variable", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const theme = createTheme({
  primaryColor: 'violet',
  primaryShade: { light: 6, dark: 5 },
  colors: { dark },
  defaultRadius: 'lg',
  fontFamily: font,
  headings: { fontFamily: font, fontWeight: '800' },
  defaultGradient: { from: 'violet', to: 'pink', deg: 135 },
  radius: { xl: '1.5rem' },
  components: {
    Card: { defaultProps: { withBorder: true, padding: 'md', radius: 'xl' } },
    Paper: { defaultProps: { withBorder: true } },
    Modal: { defaultProps: { centered: true, radius: 'xl', overlayProps: { backgroundOpacity: 0.6, blur: 6 } } },
    Button: { defaultProps: { radius: 'xl' } },
    Badge: { defaultProps: { radius: 'xl' } },
    Notification: { defaultProps: { radius: 'lg' } },
  },
});
