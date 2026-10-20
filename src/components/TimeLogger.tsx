/**
 * Sleep and wake: tap the time you fell asleep or got up instead of answering yes or no. One tap logs it,
 * and the app works out whether that hit the day's target (and how long you slept). Chips sit around your
 * target and your usual time; "Now" logs the moment you're up; "Other time" takes anything exact.
 */
import { Button, Group } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { IconCheck, IconClock, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { clockLabel, sleepTargets, timeOnTarget, type Habit } from '../lib/config';
import type { DateKey } from '../lib/dates';
import { useNow } from '../lib/hooks';
import { logicalNow } from '../lib/moments';
import { shortClock, targetFor, timeChoices, timeScale, usualTime } from '../lib/sleep';
import { useApp } from '../lib/store';
import { scrollQuietly } from '../lib/scroll';
import { accent } from '../lib/style';
import { Tap } from './ui';

interface ChipsProps {
  habit: Habit;
  date: DateKey;
  /** The time logged now, if any (highlighted). */
  selected?: string | null;
  /** `row`: one scrolling line under a habit. `grid`: big buttons (Wrap up, the habit's sheet). */
  layout?: 'row' | 'grid';
  /** Tint (the part of the day), when it isn't inherited from the row around it. */
  color?: string;
  onPick: (time: string, e?: MouseEvent) => void;
  /** Shown as a Clear chip when there's something to clear. */
  onClear?: () => void;
}

/** The one-tap times. */
export function TimeChips({ habit, date, selected, layout = 'row', color, onPick, onClear }: ChipsProps) {
  const settings = useApp((s) => s.settings);
  const days = useApp((s) => s.days);
  const now = useNow();
  const [other, setOther] = useState(false);
  const [exact, setExact] = useState(selected ?? '');
  const scroller = useRef<HTMLDivElement>(null);

  const target = targetFor(habit.id, settings, date);
  const usual = usualTime(days, habit.id, date);
  const base = timeChoices(habit.id, target, usual);
  const scale = (t: string) => timeScale(habit.id, t);
  // A time logged off the half hours (say the Watch's 12:47) gets its own chip, in order.
  const choices = selected && !base.includes(selected) ? [...base, selected].sort((a, b) => scale(a) - scale(b)) : base;
  const nearest = (t: string) => base.reduce((a, b) => (Math.abs(scale(b) - scale(t)) < Math.abs(scale(a) - scale(t)) ? b : a), base[0]);
  // Your usual time sits between the chips, so the dot goes on the closest one.
  const usualChip = usual ? nearest(usual) : null;
  // Waking up: "Now" is the quickest log there is, while it's still the morning of this day.
  const moment = logicalNow(new Date(now));
  const nowTime = habit.id !== 'sleep' && moment.date === date && moment.hour >= 4 && moment.hour < 15 ? dayjs(now).format('HH:mm') : null;
  // The chip to bring into view: what's logged, else your usual time, else the target.
  const focus = selected ?? nearest(usual ?? target);

  // Scrolled so the likely chip is in view (unless "Now" leads the row: that's the likely one).
  const leadsWithNow = !!nowTime;
  useLayoutEffect(() => {
    const el = scroller.current;
    const chip = el?.querySelector<HTMLElement>('[data-focus]');
    if (!el || !chip || leadsWithNow) return;
    scrollQuietly(el, Math.max(0, chip.offsetLeft - el.clientWidth * 0.4));
  }, [leadsWithNow]);

  const targets = sleepTargets(settings, date);
  const chip = (time: string) => {
    const ok = timeOnTarget(habit.id, time, targets);
    return (
      <Tap
        key={time}
        className="tchip"
        data-ok={ok || undefined}
        data-on={time === selected || undefined}
        data-usual={time === usualChip || undefined}
        data-focus={time === focus || undefined}
        onClick={(e) => onPick(time, e)}
        aria-label={`${clockLabel(time)}${ok ? ', on target' : ''}${time === usualChip ? ', about your usual' : ''}`}
        aria-pressed={time === selected}
      >
        {shortClock(time)}
      </Tap>
    );
  };

  const extra = (
    <>
      <Tap className="tchip" data-quiet onClick={() => setOther(!other)} aria-expanded={other}>
        <IconClock size={14} stroke={2.2} /> Other
      </Tap>
      {onClear && (
        <Tap className="tchip" data-quiet onClick={onClear}>
          Clear
        </Tap>
      )}
    </>
  );

  const exactRow = other && (
    <Group gap="xs" wrap="nowrap" mt={8} ml={layout === 'row' ? 48 : 0}>
      <TimeInput size="sm" value={exact} onChange={(e) => setExact(e.currentTarget.value)} aria-label="Exact time" style={{ flex: 1, maxWidth: 160 }} autoFocus={layout === 'grid'} />
      <Button size="sm" disabled={!exact} onClick={() => onPick(exact)}>
        Log {exact ? clockLabel(exact) : 'it'}
      </Button>
    </Group>
  );

  if (layout === 'grid') {
    return (
      <div style={color ? accent(color) : undefined}>
        {nowTime && (
          <Tap className="tnow" onClick={(e) => onPick(nowTime, e)}>
            ☀️ I'm up — {clockLabel(nowTime)}
          </Tap>
        )}
        <div className="tgrid">{choices.map(chip)}</div>
        <Group justify="center" gap={8} mt={10}>
          {extra}
        </Group>
        {exactRow}
      </div>
    );
  }

  return (
    <div style={color ? accent(color) : undefined}>
      <div className="tchips" ref={scroller}>
        {nowTime && (
          <Tap className="tchip" data-now onClick={(e) => onPick(nowTime, e)} aria-label={`Up now, ${clockLabel(nowTime)}`}>
            ☀️ Now · {shortClock(nowTime)}
          </Tap>
        )}
        {choices.map(chip)}
        {extra}
      </div>
      {exactRow}
    </div>
  );
}

/** What's logged: the time with a ✓ (on target) or ✕ (late). Tap to change it. */
export function TimePill({ time, ok, open, onClick }: { time: string | null; ok: boolean; open?: boolean; onClick: () => void }) {
  return (
    <Tap className="tpill" data-ok={ok || undefined} data-open={open || undefined} onClick={onClick} aria-label={`${time ? clockLabel(time) : ok ? 'On target' : 'Late'} — change`} aria-expanded={open}>
      {ok ? <IconCheck size={15} stroke={3} /> : <IconX size={15} stroke={3} />}
      {time ? clockLabel(time) : ok ? 'On time' : 'Late'}
    </Tap>
  );
}
