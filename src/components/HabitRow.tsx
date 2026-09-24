import { ActionIcon, Badge, Button, Group, NumberInput, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconBottle, IconBottleFilled } from '@tabler/icons-react';
import type { MouseEvent, ReactNode } from 'react';
import { BONUS, WATER_TARGET, scheduleLabel } from '../lib/config';
import { pop } from '../lib/celebrate';
import type { DateKey } from '../lib/dates';
import type { ItemEval, Streak } from '../lib/engine';
import { updateDay, useApp } from '../lib/store';
import type { DayLog } from '../lib/types';
import { floatXp } from '../lib/feedback';
import { CheckCircle, Tap, Tile } from './ui';

interface Props {
  item: ItemEval;
  date: DateKey;
  log: DayLog | undefined;
  streak: Streak;
  color: string;
  atRisk: boolean;
  focus: boolean;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function Row(props: {
  id: string;
  emoji: string;
  color: string;
  label: string;
  meta?: ReactNode;
  right?: ReactNode;
  below?: ReactNode;
  state?: 'done' | 'missed';
  focus?: boolean;
  onClick?: (e: MouseEvent) => void;
}) {
  const main = (
    <div className="hrow-main">
      <Tile emoji={props.emoji} color={props.color} dim={props.state === 'done'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="hrow-label">{props.label}</div>
        {props.meta && (
          <Group gap={6} wrap="wrap" mt={2}>
            {props.meta}
          </Group>
        )}
      </div>
      {props.right}
    </div>
  );
  return (
    <div className="hrow" id={`row-${props.id}`} data-habit={props.id} data-state={props.state} data-focus={props.focus || undefined}>
      {props.onClick ? <Tap onClick={props.onClick}>{main}</Tap> : main}
      {props.below}
    </div>
  );
}

function Meta({ children, c = 'dimmed' }: { children: ReactNode; c?: string }) {
  return (
    <Text size="xs" c={c} fw={500}>
      {children}
    </Text>
  );
}

function StreakTag({ streak, atRisk }: { streak: Streak; atRisk: boolean }) {
  if (streak.current < 2) return null;
  return (
    <Text size="xs" fw={800} c={atRisk ? 'orange.5' : 'orange.4'}>
      <span className="flame">🔥</span> {streak.current}
      {atRisk ? ' at risk' : ''}
    </Text>
  );
}

export default function HabitRow({ item, date, log, streak, color, atRisk, focus }: Props) {
  const settings = useApp((s) => s.settings);
  const { habit, done, missed, overdueDays, skipped } = item;
  const id = habit.id;
  const set = (fn: (l: DayLog) => void) => updateDay(date, fn);
  const reward = (e: { clientX: number; clientY: number } | undefined) => {
    pop(e);
    floatXp(e, `+${habit.points}`);
  };

  const meta = (
    <>
      {focus && (
        <Badge size="xs" variant="gradient">
          focus
        </Badge>
      )}
      {habit.important && !focus && (
        <Badge size="xs" variant="light" color="pink">
          key
        </Badge>
      )}
      {habit.hint && <Meta>{habit.hint}</Meta>}
      <StreakTag streak={streak} atRisk={atRisk} />
    </>
  );

  switch (habit.kind) {
    case 'check':
    case 'chore': {
      const toggle = (e: MouseEvent) => {
        if (!done) reward(e);
        set((l) => {
          l.done = { ...l.done, [id]: !done };
          if (l.skipped) delete l.skipped[id];
        });
      };
      const schedule = habit.kind === 'chore' && habit.schedule && !('every' in habit.schedule && habit.schedule.every === 1) ? scheduleLabel(habit.schedule) : null;
      return (
        <Row
          id={id}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={done ? 'done' : undefined}
          onClick={habit.skippable ? undefined : toggle}
          meta={
            <>
              {overdueDays > 0 && !done && (
                <Badge size="xs" color="orange" variant="filled">
                  {overdueDays}d overdue
                </Badge>
              )}
              {skipped && (
                <Badge size="xs" color="gray" variant="light">
                  skipped
                </Badge>
              )}
              {schedule && <Meta>{schedule}</Meta>}
              {meta}
            </>
          }
          right={
            habit.skippable ? (
              <Group gap={6} wrap="nowrap">
                {!done && (
                  <Tap
                    onClick={() =>
                      set((l) => {
                        l.skipped = { ...l.skipped, [id]: !skipped };
                      })
                    }
                  >
                    <Button component="div" size="compact-xs" variant={skipped ? 'filled' : 'subtle'} color="gray">
                      {skipped ? 'Undo skip' : 'Skip'}
                    </Button>
                  </Tap>
                )}
                {!skipped && (
                  <Tap onClick={toggle} aria-label={habit.label}>
                    <CheckCircle checked={done} />
                  </Tap>
                )}
              </Group>
            ) : (
              <CheckCircle checked={done} />
            )
          }
        />
      );
    }

    case 'time': {
      const answer = log?.done?.[id];
      const yes = (e: MouseEvent) => {
        if (answer !== true) reward(e);
        set((l) => {
          l.done = { ...l.done, [id]: answer === true ? undefined : true } as Record<string, boolean>;
          if (l.times) delete l.times[id];
        });
      };
      const no = () =>
        set((l) => {
          l.done = { ...l.done, [id]: answer === false ? undefined : false } as Record<string, boolean>;
        });
      return (
        <Row
          id={id}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={done ? 'done' : missed ? 'missed' : undefined}
          meta={
            <>
              {missed && log?.times?.[id] && <Meta c="red.4">~{log.times[id]}</Meta>}
              {log?.sleepAuto && <Meta>⌚ {id === 'sleep' ? log.sleepAuto.asleep : log.sleepAuto.awake}</Meta>}
              {meta}
            </>
          }
          right={
            <Group gap={8} wrap="nowrap">
              <Tap onClick={no} aria-label="No">
                <CheckCircle checked={false} missed={answer === false} idle="x" />
              </Tap>
              <Tap onClick={yes} aria-label="Yes">
                <CheckCircle checked={answer === true} idle="check" />
              </Tap>
            </Group>
          }
          below={
            missed && (
              <TimeInput
                mt="xs"
                ml={50}
                size="sm"
                radius="md"
                description={habit.missPrompt}
                value={log?.times?.[id] ?? ''}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  set((l) => {
                    l.times = { ...l.times, [id]: v };
                  });
                }}
              />
            )
          }
        />
      );
    }

    case 'water': {
      const water = log?.water ?? 0;
      return (
        <Row
          id={id}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={done ? 'done' : undefined}
          meta={
            <>
              <Meta>
                {water}/{WATER_TARGET} bottles
              </Meta>
              {meta}
            </>
          }
          right={
            <Group gap={2} wrap="nowrap">
              {Array.from({ length: WATER_TARGET }, (_, i) => {
                const filled = i < water;
                return (
                  <Tap
                    key={i}
                    aria-label={`Bottle ${i + 1}`}
                    onClick={(e) => {
                      const next = filled && water === i + 1 ? i : i + 1;
                      if (next > water) {
                        pop(e);
                        if (next >= WATER_TARGET) floatXp(e, `+${habit.points}`);
                      }
                      set((l) => {
                        l.water = next;
                      });
                    }}
                  >
                    <ActionIcon component="div" size={40} radius="xl" variant={filled ? 'light' : 'subtle'} color={filled ? 'blue' : 'gray'}>
                      {filled ? <IconBottleFilled size={24} /> : <IconBottle size={24} />}
                    </ActionIcon>
                  </Tap>
                );
              })}
            </Group>
          }
        />
      );
    }

    case 'dose': {
      const ml = log?.finMl ?? null;
      // % w/v → mg per ml: 0.025% = 0.025 g / 100 ml = 0.25 mg/ml
      const mgPerMl = settings.finConcentration * 10;
      const toggle = (e: MouseEvent) => {
        if (!done) reward(e);
        set((l) => {
          l.finMl = done ? null : settings.finTargetMl;
        });
      };
      return (
        <Row
          id={id}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={done ? 'done' : undefined}
          meta={
            <>
              <Meta>{ml ? `${ml} ml · ${(ml * mgPerMl).toFixed(3)} mg` : `${settings.finTargetMl} ml · ${settings.finConcentration}%`}</Meta>
              <StreakTag streak={streak} atRisk={atRisk} />
            </>
          }
          right={
            <Group gap={8} wrap="nowrap" onClick={stop}>
              {done && (
                <NumberInput
                  w={84}
                  size="sm"
                  radius="md"
                  inputMode="decimal"
                  suffix=" ml"
                  step={0.1}
                  decimalScale={2}
                  min={0}
                  max={10}
                  hideControls
                  value={ml ?? ''}
                  onChange={(v) =>
                    set((l) => {
                      l.finMl = typeof v === 'number' ? v : null;
                    })
                  }
                />
              )}
              <Tap onClick={toggle} aria-label={habit.label}>
                <CheckCircle checked={done} />
              </Tap>
            </Group>
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
        const next = answer === value ? undefined : value;
        if (next === 'clean') reward(e);
        if (next === 'slip') {
          const usedAfter = (allowance?.used ?? 0) + 1;
          if (allowance && usedAfter <= allowance.limit) {
            notifications.show({ color: 'orange', title: 'Logged — within your allowance', message: `That's ${usedAfter} of ${allowance.limit} for this week. Streak's safe.` });
          } else {
            notifications.show({ color: 'gray', title: 'Logged. Honesty beats streaks.', message: 'Tomorrow is a fresh start — be better than today.' });
          }
        }
        set((l) => {
          const avoid = { ...l.avoid };
          if (next) avoid[id] = next;
          else delete avoid[id];
          l.avoid = avoid;
        });
      };
      return (
        <Row
          id={id}
          emoji={habit.emoji}
          color={color}
          label={habit.label}
          focus={focus}
          state={answer === 'clean' ? 'done' : missed ? 'missed' : undefined}
          meta={
            <>
              {allowance && allowance.limit > 0 && (
                <Meta c={allowance.used > allowance.limit ? 'red.4' : allowance.used === allowance.limit ? 'orange.4' : 'dimmed'}>
                  {allowance.used}/{allowance.limit} this week
                </Meta>
              )}
              {meta}
              <Tap
                aria-label="I beat an urge"
                onClick={(e) => {
                  if (urges < BONUS.urgeCap) floatXp(e, `+${BONUS.urge}`);
                  pop(e);
                  set((l) => {
                    l.urges = { ...l.urges, [id]: urges + 1 };
                  });
                  notifications.show({
                    color: 'teal',
                    title: `💪 Urge beaten${urges ? ` (${urges + 1} today)` : ''}`,
                    message: 'Cravings peak and pass in about 10 minutes. Ride it out.',
                  });
                }}
              >
                <Badge component="div" size="sm" variant="light" color="grape" style={{ textTransform: 'none', cursor: 'pointer' }}>
                  💪 {urges ? `${urges} urge${urges === 1 ? '' : 's'} beaten` : 'beat an urge'}
                </Badge>
              </Tap>
            </>
          }
          right={
            <Group gap={6} wrap="nowrap">
              <Tap onClick={(e) => choose('slip', e)} aria-label={slipLabel}>
                <Button
                  component="div"
                  size="compact-sm"
                  variant={answer === 'slip' ? 'filled' : 'default'}
                  color={answer === 'slip' && allowance?.allowed ? 'orange' : 'red'}
                  px={10}
                >
                  {slipLabel}
                </Button>
              </Tap>
              <Tap onClick={(e) => choose('clean', e)} aria-label="Clean">
                <Button
                  component="div"
                  size="compact-sm"
                  variant={answer === 'clean' ? 'gradient' : 'default'}
                  gradient={{ from: 'teal.5', to: 'green.6', deg: 135 }}
                  px={12}
                >
                  Clean
                </Button>
              </Tap>
            </Group>
          }
        />
      );
    }
  }
}
