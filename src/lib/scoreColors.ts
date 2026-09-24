/**
 * One hue (teal = "done") stepping away from the page surface: the more of your list you did, the stronger the colour.
 * Shared by the calendar and the progress heatmap so they read the same.
 */
export const SCORE_COLORS = {
  light: ['#c3fae8', '#96f2d7', '#38d9a9', '#12b886', '#087f5b'],
  dark: ['#123a31', '#136150', '#0f8a6c', '#20c997', '#63e6be'],
};

export function scoreColor(pct: number, scheme: 'light' | 'dark'): { bg: string; fg: string } {
  const idx = Math.min(4, Math.floor(pct / 20));
  const strong = idx >= 3;
  return {
    bg: SCORE_COLORS[scheme][idx],
    fg: scheme === 'dark' ? (strong ? '#0a0a0f' : '#e9fbf4') : strong ? '#ffffff' : '#0b3d2e',
  };
}
