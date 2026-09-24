/** One-tap bulk actions shared by "Up next" and the section quick buttons. */
import { floatXp, notifyUndo } from './feedback';
import { pop } from './celebrate';
import type { Habit } from './config';
import type { DateKey } from './dates';
import { setDay, updateDay, useApp } from './store';

export function tickAll(date: DateKey, habits: Habit[], e?: { clientX: number; clientY: number }) {
  if (!habits.length) return;
  const { days, settings } = useApp.getState();
  const before = structuredClone(days[date] ?? {});
  updateDay(date, (l) => {
    for (const h of habits) {
      if (h.kind === 'avoid') l.avoid = { ...l.avoid, [h.id]: 'clean' };
      else if (h.kind === 'dose') l.finMl = settings.finTargetMl;
      else {
        l.done = { ...l.done, [h.id]: true };
        if (l.skipped) delete l.skipped[h.id];
      }
    }
  });
  pop(e);
  floatXp(e, `+${habits.reduce((s, h) => s + h.points, 0)}`);
  notifyUndo(`${habits.length} ticked off`, () => setDay(date, before));
}

export function addWater(date: DateKey) {
  updateDay(date, (l) => {
    l.water = (l.water ?? 0) + 1;
  });
  pop();
}

export function scrollToAndFlash(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
