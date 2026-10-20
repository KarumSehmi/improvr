import { Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBottle, IconBottleFilled, IconMinus, IconPlus } from '@tabler/icons-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { answerClean, beatUrge, bump, logTime, setDone, setSkipped, targetOf } from '../lib/actions';
import { habitLabel, scheduleLabel, sleepTargets } from '../lib/config';
import type { DateKey } from '../lib/dates';
import { everyOn, slipFineAmount, type ItemEval, type Streak } from '../lib/engine';
import { openHabit } from '../lib/hooks';
import { formatDuration, loggedTime, nightOf, offBy, targetFor } from '../lib/sleep';
import { updateDay, updateSettings, useApp } from '../lib/store';
import type { DayLog } from '../lib/types';
import { TimeChips, TimePill } from './TimeLogger';
import { CheckCircle, M, Meta, Seg, Stepper, Tap, Tile } from './ui';
import { accent } from '../lib/style';

interface Props {
  item: ItemEval;
  date: DateKey;
  log: DayLog | undefined;
  streak: Streak;
  color: string;
  atRisk: boolean;
  focus: boolean;
}

/** Finasteride goes up or down in steps of this many ml. */
const DOSE_STEP = 0.25;

function Row(props: {
  id: string;
  date: DateKey;
  emoji: string;
  color: string;
  label: string;
  meta?: ReactNode;
  right?: ReactNode;
  below?: ReactNode;
  state?: 'done' | 'missed' | 'skipped';
  focus?: boolean;
  onClick?: (e: MouseEvent) => void;
}) {
  const more = () => openHabit(props.id, props.date);
  const main = (
    <div className="hrow-main">
      <Tile emoji={props.emoji} color={props.color} dim={props.state === 'done'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="hrow-label">{props.label}</div>
        {props.meta}
      </div>
      {props.right}
    </div>
  );
  return (
    <div className="hrow" id={`row-${props.id}`} data-habit={props.id} data-state={props.state} data-focus={props.focus || undefined} style={accent(props.color)}>
      {props.onClick ? (
        <Tap key="tap" onClick={props.onClick} onLongPress={more} aria-label={props.label} aria-pressed={props.state === 'done'}>
          {main}
        </Tap>
      ) : (
        // Rows with their own buttons still open the habit sheet when you hold the name. No haptic switch here:
        // it would cover those buttons on iPhone (and the different key stops React reusing a row that had one).
        <Tap key="group" haptic={false} onClick={() => {}} onLongPress={more} tabIndex={-1} role="group" style={{ cursor: 'default' }}>
          {main}
        </Tap>
      )}
      {props.below}
    </div>
  );
}

function StreakBits({ streak, atRisk }: { streak: Streak; atRisk: boolean }) {
  // A broken streak still has a record to chase — that's the number to beat.
  if (streak.current < 2) return streak.best >= 5 ? <M>🏁 best {streak.best}</M> : null;
  return (
    <M tone={atRisk ? 'warn' : 'streak'}>
      <span className="flame">🔥</span> {streak.current}
      {atRisk ? ' at risk' : ''}
    </M>
  );
}

/**
 * Sleep / wake: tap the time you fell asleep or got up, no yes or no. Once it's in, it shows with a ✓ (on target)
 * or ✕ (late) — tap that to change it. The Apple Watch fills it in when it syncs.
 */
function TimeRow({ item, date, log, color, focus, common }: { item: ItemEval; date: DateKey; log: DayLog | undefined; color: string; focus: boolean; common: ReactNode }) {
  const settings = useApp((s) => s.settings);
  const [editing, setEditing] = useState(false);
  const { habit, done, missed } = item;
  const id = habit.id;
  const answer = log?.done?.[id];
  // What you logged, or the Watch's time. An old plain "yes" (or "close the rest") may have no time.
  const time = answer == null ? null : (log?.times?.[id] ?? loggedTime(id, log));
  const watch = !!log?.sleepAuto && time === (id === 'sleep' ? log.sleepAuto.asleep : log.sleepAuto.awake);
  const mins = id === 'sleep' && time ? nightOf(log).mins : null;
  const pick = (t: string, e?: MouseEvent) => {
    logTime(date, habit, t, e);
    setEditing(false);
  };
  const clear = () => {
    logTime(date, habit, null);
    setEditing(false);
  };
  return (
    <Row
      id={id}
      date={date}
      emoji={habit.emoji}
      color={color}
      label={habitLabel(habit, settings, date)}
      focus={focus}
      state={done ? 'done' : missed ? 'missed' : undefined}
      meta={
        <Meta>
          {sleepTargets(settings, date).weekend && <M tone="accent">weekend</M>}
          {time && (
            <M tone={answer ? 'good' : 'bad'}>
              {watch ? '⌚ ' : ''}
              {offBy(id, time, targetFor(id, settings, date))}
            </M>
          )}
          {!time && answer === false && <M tone="bad">late · what time?</M>}
          {mins != null && <M>{formatDuration(mins)} asleep</M>}
          {common}
        </Meta>
      }
      right={answer != null ? <TimePill time={time} ok={answer} open={editing} onClick={() => setEditing(!editing)} /> : null}
      below={answer == null || editing || (answer === false && !time) ? <TimeChips habit={habit} date={date} selected={time} onPick={pick} onClear={answer != null ? clear : undefined} /> : null}
    />
  );
}

export default function HabitRow({ item, date, log, streak, color, atRisk, focus }: Props) {
  const settings = useApp((s) => s.settings);
  const { habit, done, missed, overdueDays, skipped } = item;
  const id = habit.id;
  // Set to every few days in Settings → Habits
  const every = everyOn(settings, id, date);
  // Once sleep or wake has its time, that says when ("last night" would just repeat it).
  const hint = habit.hint && !(habit.kind === 'time' && log?.done?.[id] != null);
  const common = (
    <>
      {habit.important && !focus && <M tone="accent">★ key</M>}
      {habit.optional && <M tone="accent">bonus</M>}
      {hint && <M>{habit.hint}</M>}
      <StreakBits streak={streak} atRisk={atRisk} />
    </>
  );
  const overdue = overdueDays > 0 && !done && !missed ? <M tone="warn">{overdueDays}d overdue</M> : null;
  const often = every > 1 ? <M>{scheduleLabel({ every })}</M> : null;
  const state = done ? 'done' : missed ? 'missed' : skipped ? 'skipped' : undefined;

  switch (habit.kind) {
    case 'check':
    case 'chore': {
      const toggle = (e: MouseEvent) => setDone(date, habit, !done, e);
      const schedule = habit.kind === 'chore' && habit.schedule && !('every' in habit.schedule && habit.schedule.every === 1) ? scheduleLabel(habit.schedule) : null;
      return (
        <Row
          id={id}
          date={date}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={state}
          onClick={habit.skippable ? undefined : toggle}
          meta={
            <Meta>
              {missed && <M tone="bad">{habit.kind === 'chore' ? 'not today' : 'not done'}</M>}
              {overdue}
              {skipped && <M>skipped</M>}
              {often}
              {schedule && <M>{schedule}</M>}
              {common}
            </Meta>
          }
          right={
            habit.skippable ? (
              <Group gap={8} wrap="nowrap">
                {!done && (
                  <Tap className="chip" data-small onClick={() => setSkipped(date, habit, !skipped)}>
                    {skipped ? 'Undo skip' : 'Skip'}
                  </Tap>
                )}
                {!skipped && (
                  <Tap onClick={toggle} aria-label={habit.label}>
                    <CheckCircle checked={done} missed={missed} color={color} />
                  </Tap>
                )}
              </Group>
            ) : (
              <CheckCircle checked={done} missed={missed} color={color} />
            )
          }
        />
      );
    }

    case 'time':
      return <TimeRow item={item} date={date} log={log} color={color} focus={focus} common={common} />;

    case 'water':
    case 'count': {
      const target = targetOf(habit);
      const value = habit.kind === 'water' ? (log?.water ?? 0) : (log?.counts?.[id] ?? 0);
      const unit = habit.kind === 'water' ? (target === 1 ? 'bottle' : 'bottles') : (habit.unit ?? '');
      const bottles = habit.kind === 'water' && target <= 4;
      return (
        <Row
          id={id}
          date={date}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={state}
          meta={
            <Meta>
              {missed && <M tone="bad">not done</M>}
              {overdue}
              {!bottles && (
                <M tone={done ? 'good' : undefined}>
                  {value}/{target}
                  {unit ? ` ${unit}` : ''}
                </M>
              )}
              {bottles && (
                <M>
                  {value}/{target} {unit}
                </M>
              )}
              {often}
              {common}
            </Meta>
          }
          right={
            bottles ? (
              <Group gap={2} wrap="nowrap">
                {Array.from({ length: target }, (_, i) => {
                  const filled = i < value;
                  return (
                    <Tap
                      key={i}
                      aria-label={`Bottle ${i + 1}`}
                      onClick={(e) => {
                        const next = filled && value === i + 1 ? i : i + 1;
                        bump(date, habit, next - value, e);
                      }}
                      style={{
                        width: 36,
                        height: 40,
                        borderRadius: 12,
                        display: 'grid',
                        placeItems: 'center',
                        color: filled ? 'var(--accent-text)' : 'var(--text-3)',
                        background: filled ? 'var(--accent-soft)' : 'transparent',
                      }}
                    >
                      {filled ? <IconBottleFilled size={22} /> : <IconBottle size={22} stroke={1.6} />}
                    </Tap>
                  );
                })}
              </Group>
            ) : (
              <Stepper value={value} target={target} color={color} onChange={(d, e) => bump(date, habit, d, e)} />
            )
          }
        />
      );
    }

    case 'dose': {
      const ml = log?.finMl ?? null;
      // % w/v → mg per ml: 0.025% = 0.025 g / 100 ml = 0.25 mg/ml
      const mgPerMl = settings.finConcentration * 10;
      const mg = (v: number) => `${+(v * mgPerMl).toFixed(3)} mg`;
      const toggle = (e: MouseEvent) => setDone(date, habit, !done, e);
      // Used more or less than usual today? Nudge it up or down (typing "0.5" would untick the row at "0").
      const nudge = (delta: number) =>
        updateDay(date, (l) => {
          l.finMl = Math.max(DOSE_STEP, Math.round(((l.finMl ?? 0) + delta) * 100) / 100);
        });
      const usual = ml === settings.finTargetMl;
      return (
        <Row
          id={id}
          date={date}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={state}
          onClick={done ? undefined : toggle}
          meta={
            <Meta>
              {missed && <M tone="bad">not done</M>}
              {overdue}
              <M>{ml ? mg(ml) : `${settings.finTargetMl} ml · ${mg(settings.finTargetMl)}`}</M>
              {often}
              {common}
            </Meta>
          }
          right={
            done && ml != null ? (
              <Group gap={6} wrap="nowrap">
                <div className="stepper">
                  <Tap className="stepper-btn" onClick={() => nudge(-DOSE_STEP)} aria-label={`${DOSE_STEP} ml less`}>
                    <IconMinus size={15} stroke={2.4} />
                  </Tap>
                  <div className="stepper-val">{ml} ml</div>
                  <Tap className="stepper-btn" onClick={() => nudge(DOSE_STEP)} aria-label={`${DOSE_STEP} ml more`}>
                    <IconPlus size={15} stroke={2.4} />
                  </Tap>
                </div>
                <Tap onClick={toggle} aria-label={`Untick ${habit.label}`}>
                  <CheckCircle checked missed={false} color={color} />
                </Tap>
              </Group>
            ) : (
              <CheckCircle checked={done} missed={missed} color={color} />
            )
          }
          below={
            done && ml != null && !usual ? (
              <Group justify="flex-end" mt={4}>
                <Button size="compact-xs" variant="subtle" color="gray" onClick={() => updateSettings({ finTargetMl: ml })}>
                  Make {ml} ml my usual amount
                </Button>
              </Group>
            ) : null
          }
        />
      );
    }

    case 'avoid': {
      const answer = log?.avoid?.[id];
      const allowance = item.allowance;
      const urges = log?.urges?.[id] ?? 0;
      const slipLabel = habit.weeklyLimit ? (id === 'alcohol' ? 'Drank' : 'Did it') : 'Slipped';
      // Stay-clean habits with a charity fine (e.g. £5 a nicotine slip) keep the stakes in sight.
      const fine = slipFineAmount(settings, id, date);
      const choose = (value: 'clean' | 'slip', e: MouseEvent) => {
        const next = answer === value ? null : value;
        const usedAfter = (allowance?.used ?? 0) + 1;
        // A fined slip says what it cost; otherwise a word about honesty (or the allowance).
        if (answerClean(date, habit, next, e) || next !== 'slip') return;
        if (allowance && usedAfter <= allowance.limit) {
          notifications.show({ color: 'orange', title: 'Logged — within your allowance', message: `That's ${usedAfter} of ${allowance.limit} for this week. Streak's safe.` });
        } else {
          notifications.show({ color: 'gray', title: 'Logged. Honesty beats streaks.', message: 'Tomorrow is a fresh start — be better than today.' });
        }
      };
      return (
        <Row
          id={id}
          date={date}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={answer === 'clean' ? 'done' : missed ? 'missed' : undefined}
          meta={
            <Meta>
              {allowance && allowance.limit > 0 && (
                <M tone={allowance.used > allowance.limit ? 'bad' : allowance.used === allowance.limit ? 'warn' : undefined}>
                  {allowance.used}/{allowance.limit} this week
                </M>
              )}
              {fine > 0 && answer === 'slip' && missed && <M tone="bad">£{fine} to charity</M>}
              {fine > 0 && !answer && <M tone="bad">£{fine} a slip</M>}
              {streak.current >= 2 && <StreakBits streak={streak} atRisk={atRisk} />}
              {urges > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    beatUrge(date, habit, e);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && beatUrge(date, habit)}
                  aria-label="I beat another urge"
                  style={{ color: 'var(--urge)', fontWeight: 750, cursor: 'pointer' }}
                >
                  💪 {urges} beaten
                </span>
              )}
            </Meta>
          }
          right={
            <Seg
              value={answer}
              options={[
                { value: 'slip', label: slipLabel, tone: answer === 'slip' && allowance?.allowed ? 'warn' : 'bad' },
                { value: 'clean', label: 'Clean', tone: 'good' },
              ]}
              onChange={choose}
            />
          }
        />
      );
    }
  }
}

