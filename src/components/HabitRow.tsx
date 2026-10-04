import { Button, Group } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconBottle, IconBottleFilled, IconCheck, IconMinus, IconPlus, IconX } from '@tabler/icons-react';
import type { MouseEvent, ReactNode } from 'react';
import { answerClean, answerTime, beatUrge, bump, setDone, setSkipped, targetOf } from '../lib/actions';
import { habitLabel, scheduleLabel, sleepTargets } from '../lib/config';
import type { DateKey } from '../lib/dates';
import { everyOn, type ItemEval, type Streak } from '../lib/engine';
import { openHabit } from '../lib/hooks';
import { formatDuration, sleepMinutes } from '../lib/sleep';
import { updateDay, updateSettings, useApp } from '../lib/store';
import type { DayLog } from '../lib/types';
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
        <Tap onClick={props.onClick} onLongPress={more} aria-label={props.label} aria-pressed={props.state === 'done'}>
          {main}
        </Tap>
      ) : (
        // Rows with their own buttons still open the habit sheet when you hold the name.
        <Tap onClick={() => {}} onLongPress={more} tabIndex={-1} role="group" style={{ cursor: 'default' }}>
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

export default function HabitRow({ item, date, log, streak, color, atRisk, focus }: Props) {
  const settings = useApp((s) => s.settings);
  const { habit, done, missed, overdueDays, skipped } = item;
  const id = habit.id;
  // Set to every few days in Settings → Habits
  const every = everyOn(settings, id, date);
  const common = (
    <>
      {habit.important && !focus && <M tone="accent">★ key</M>}
      {habit.optional && <M tone="accent">bonus</M>}
      {habit.hint && <M>{habit.hint}</M>}
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

    case 'time': {
      const answer = log?.done?.[id];
      // Filled in by the Apple Watch Shortcut, if you've set it up.
      const watch = log?.sleepAuto;
      const watchTime = watch ? (id === 'sleep' ? watch.asleep : watch.awake) : null;
      return (
        <Row
          id={id}
          date={date}
          emoji={habit.emoji}
          color={color}
          label={habitLabel(habit, settings, date)}
          focus={focus}
          state={state}
          meta={
            <Meta>
              {sleepTargets(settings, date).weekend && <M tone="accent">weekend</M>}
              {watch ? (
                <M tone={missed ? 'bad' : undefined}>⌚ {id === 'sleep' ? `asleep ${watch.asleep} · ${formatDuration(sleepMinutes(watch.asleep, watch.awake))}` : `up ${watch.awake}`}</M>
              ) : (
                missed && log?.times?.[id] && <M tone="bad">~{log.times[id]}</M>
              )}
              {common}
            </Meta>
          }
          right={
            <Seg
              value={answer === true ? 'yes' : answer === false ? 'no' : null}
              options={[
                { value: 'no', label: <IconX size={17} stroke={2.6} />, tone: 'bad', aria: 'No' },
                { value: 'yes', label: <IconCheck size={17} stroke={2.8} />, tone: 'good', aria: 'Yes' },
              ]}
              onChange={(v, e) => {
                const yes = v === 'yes';
                if (yes) answerTime(date, habit, answer === true ? null : true, e);
                else answerTime(date, habit, answer === false ? null : false, e);
              }}
            />
          }
          below={
            missed && (
              <TimeInput
                mt="xs"
                ml={48}
                size="sm"
                description={habit.missPrompt}
                value={log?.times?.[id] ?? watchTime ?? ''}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  updateDay(date, (l) => {
                    l.times = { ...l.times, [id]: v };
                  });
                }}
              />
            )
          }
        />
      );
    }

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
      const choose = (value: 'clean' | 'slip', e: MouseEvent) => {
        const next = answer === value ? null : value;
        if (next === 'slip') {
          const usedAfter = (allowance?.used ?? 0) + 1;
          if (allowance && usedAfter <= allowance.limit) {
            notifications.show({ color: 'orange', title: 'Logged — within your allowance', message: `That's ${usedAfter} of ${allowance.limit} for this week. Streak's safe.` });
          } else {
            notifications.show({ color: 'gray', title: 'Logged. Honesty beats streaks.', message: 'Tomorrow is a fresh start — be better than today.' });
          }
        }
        answerClean(date, habit, next, e);
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
                  style={{ color: 'var(--mantine-color-grape-4)', fontWeight: 750, cursor: 'pointer' }}
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

