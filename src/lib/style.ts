import type { CSSProperties } from 'react';

/** CSS variables for an accent colour (a Mantine colour name), used by tiles, checks, bars and chips. */
export function accent(color: string): CSSProperties {
  return {
    '--accent': `var(--mantine-color-${color}-filled)`,
    '--accent-soft': `var(--mantine-color-${color}-light)`,
    '--accent-text': `var(--mantine-color-${color}-light-color)`,
  } as CSSProperties;
}
