/**
 * When the page last scrolled, so a tap that's really the end of a scroll can be ignored (see Tap).
 * Strips the app scrolls into place itself don't count — they'd swallow the next tap.
 */
let last = 0;
let quiet: EventTarget | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'scroll',
    (e) => {
      if (e.target === quiet) quiet = null;
      else last = performance.now();
    },
    { capture: true, passive: true },
  );
}

export const lastScroll = () => last;

/** Scroll a strip into place without it counting as the person scrolling. */
export function scrollQuietly(el: HTMLElement, left: number) {
  const before = el.scrollLeft;
  el.scrollLeft = left;
  // The scroll event comes later, and only if it actually moved.
  if (el.scrollLeft !== before) quiet = el;
}
