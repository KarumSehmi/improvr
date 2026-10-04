import { createTheme, type MantineColorsTuple } from '@mantine/core';

/** Near-black with a hint of violet: body is [7], inputs [6], hover [5], borders [4]. */
const dark: MantineColorsTuple = [
  '#ECECF4',
  '#C2C2D2',
  '#8F8FA6',
  '#64647A',
  '#33334A',
  '#262634',
  '#1B1B26',
  '#0B0B11',
  '#08080C',
  '#050507',
];

const font =
  '"Plus Jakarta Sans Variable", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const theme = createTheme({
  primaryColor: 'violet',
  primaryShade: { light: 6, dark: 5 },
  colors: { dark },
  defaultRadius: 'lg',
  fontFamily: font,
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  headings: { fontFamily: font, fontWeight: '800' },
  defaultGradient: { from: 'violet', to: 'pink', deg: 135 },
  radius: { xs: '0.5rem', sm: '0.75rem', md: '0.875rem', lg: '1rem', xl: '1.375rem' },
  cursorType: 'pointer',
  respectReducedMotion: true,
  components: {
    Card: { defaultProps: { withBorder: true, padding: 'md', radius: 'xl' } },
    Paper: { defaultProps: { withBorder: true } },
    Modal: {
      defaultProps: { centered: true, radius: 'xl', overlayProps: { backgroundOpacity: 0.55, blur: 8 }, transitionProps: { transition: 'pop', duration: 180 } },
    },
    Drawer: { defaultProps: { overlayProps: { backgroundOpacity: 0.55, blur: 6 } } },
    Button: { defaultProps: { radius: 'xl' } },
    ActionIcon: { defaultProps: { radius: 'xl' } },
    Badge: { defaultProps: { radius: 'xl' } },
    Notification: { defaultProps: { radius: 'lg' } },
    SegmentedControl: { defaultProps: { radius: 'xl' } },
    TextInput: { defaultProps: { radius: 'md' } },
    NumberInput: { defaultProps: { radius: 'md' } },
    Textarea: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md' } },
    Tooltip: { defaultProps: { radius: 'md', withArrow: true } },
  },
});
