import { ActionIcon, Badge, Button, Checkbox, Group, NumberInput, Paper, Stack, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconBottle, IconBottleFilled, IconCheck, IconX } from '@tabler/icons-react';
import type { MouseEvent, ReactNode } from 'react';
import { WATER_TARGET } from '../lib/config';
import { pop } from '../lib/celebrate';
import type { DateKey } from '../lib/dates';
import type { ItemEval, Streak } from '../lib/engine';
import { updateDay, useApp } from '../lib/store';
import type { DayLog } from '../lib/types';

interface Props {
  item: ItemEval;
  date: DateKey;
  log: DayLog | undefined;
  streak: Streak;
  lastWeight: number | null;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function Shell(props: {
  id: string;
  emoji: string;
  label: string;
  meta?: ReactNode;
  right?: ReactNode;
  below?: ReactNode;
  state?: 'done' | 'missed' | 'overdue';
  onClick?: (e: MouseEvent) => void;
}) {
  return (
    <Paper
      data-habit={props.id}
      p="xs"
      pl="sm"
      radius="md"
      className={props.state ? `row-${props.state}` : undefined}
      onClick={props.onClick}
      role={props.onClick ? 'button' : undefined}
      style={{ cursor: props.onClick ? 'pointer' : undefined, userSelect: 'none', transition: 'background 150ms' }}
    >
      <Group wrap="nowrap" gap="sm" mih={40}>
        <Text fz={22} w={30} ta="center" style={{ flexShrink: 0 }}>
          {props.emoji}
        </Text>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} size="sm" lh={1.25}>
            {props.label}
          </Text>
          {props.meta && (
            <Group gap={6} wrap="wrap">
              {props.meta}
            </Group>
          )}
        </Stack>
        {props.right}
      </Group>
      {props.below}
    </Paper>
  );
}

function StreakTag({ streak, important }: { streak: Streak; important?: boolean }) {
  if (streak.current < 2) return null;
  return (
    <Text size="xs" fw={700} c={important ? 'orange.5' : 'orange.4'}>
      <span className="flame">🔥</span> {streak.current}
    </Text>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <Text size="xs" c="dimmed">
      {children}
    </Text>
  );
}

export default function HabitRow({ item, date, log, streak, lastWeight }: Props) {
  const settings = useApp((s) => s.settings);
  const { habit, done, missed, overdueDays, skipped } = item;
  const id = habit.id;
  const set = (fn: (l: DayLog) => void) => updateDay(date, fn);

  const baseMeta = (
    <>
      {habit.important && (
        <Badge size="xs" variant="light" color="pink">
          key
        </Badge>
      )}
      {habit.hint && <Hint>{habit.hint}</Hint>}
      <StreakTag streak={streak} important={habit.important} />
    </>
  );

  switch (habit.kind) {
    case 'check':
    case 'chore': {
      const toggle = (e: MouseEvent) => {
        if (!done) pop(e);
        set((l) => {
          l.done = { ...l.done, [id]: !done };
          if (l.skipped) delete l.skipped[id];
        });
      };
      return (
        <Shell
          id={id}
          emoji={habit.emoji}
          label={habit.label}
          state={done ? 'done' : overdueDays > 0 ? 'overdue' : undefined}
          onClick={skipped ? undefined : toggle}
          meta={
            <>
              {overdueDays > 0 && !done && (
                <Badge size="xs" color="orange" variant="light">
                  carried over · {overdueDays}d
                </Badge>
              )}
              {skipped && (
                <Badge size="xs" color="gray" variant="light">
                  skipped
                </Badge>
              )}
              {baseMeta}
            </>
          }
          right={
            <Group gap={6} wrap="nowrap" onClick={stop}>
              {habit.skippable && !done && (
                <Button
                  size="compact-xs"
                  variant={skipped ? 'filled' : 'subtle'}
                  color="gray"
                  onClick={() =>
                    set((l) => {
                      l.skipped = { ...l.skipped, [id]: !skipped };
                    })
                  }
                >
                  {skipped ? 'Undo skip' : 'Skip'}
                </Button>
              )}
              {!skipped && (
                <div onClick={toggle} style={{ cursor: 'pointer' }}>
                  <Checkbox.Indicator checked={done} size="lg" radius="xl" color="teal" />
                </div>
              )}
            </Group>
          }
        />
      );
    }

    case 'time': {
      const answer = log?.done?.[id];
      return (
        <Shell
          id={id}
          emoji={habit.emoji}
          label={habit.label}
          state={done ? 'done' : missed ? 'missed' : undefined}
          meta={
            <>
              {missed && log?.times?.[id] && <Hint>~{log.times[id]}</Hint>}
              {baseMeta}
            </>
          }
          right={
            <Group gap={6} wrap="nowrap">
              <ActionIcon
                size="lg"
                radius="xl"
                variant={answer === true ? 'filled' : 'default'}
                color="teal"
                aria-label="Yes"
                onClick={(e) => {
                  if (answer !== true) pop(e);
                  set((l) => {
                    l.done = { ...l.done, [id]: true };
                    if (l.times) delete l.times[id];
                  });
                }}
              >
                <IconCheck size={18} />
              </ActionIcon>
              <ActionIcon
                size="lg"
                radius="xl"
                variant={answer === false ? 'filled' : 'default'}
                color="red"
                aria-label="No"
                onClick={() =>
                  set((l) => {
                    l.done = { ...l.done, [id]: false };
                  })
                }
              >
                <IconX size={18} />
              </ActionIcon>
            </Group>
          }
          below={
            missed && (
              <TimeInput
                mt="xs"
                size="sm"
                label={habit.missPrompt}
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
        <Shell
          id={id}
          emoji={habit.emoji}
          label={habit.label}
          state={done ? 'done' : undefined}
          meta={
            <>
              <Hint>
                {water}/{WATER_TARGET} bottles
              </Hint>
              {baseMeta}
            </>
          }
          right={
            <Group gap={4} wrap="nowrap">
              {Array.from({ length: WATER_TARGET }, (_, i) => {
                const filled = i < water;
                return (
                  <ActionIcon
                    key={i}
                    size="xl"
                    radius="xl"
                    variant={filled ? 'light' : 'subtle'}
                    color={filled ? 'blue' : 'gray'}
                    aria-label={`Bottle ${i + 1}`}
                    onClick={(e) => {
                      const next = filled && water === i + 1 ? i : i + 1;
                      if (next > water) pop(e);
                      set((l) => {
                        l.water = next;
                      });
                    }}
                  >
                    {filled ? <IconBottleFilled size={24} /> : <IconBottle size={24} />}
                  </ActionIcon>
                );
              })}
            </Group>
          }
        />
      );
    }

    case 'weight': {
      const delta = log?.weight && lastWeight ? log.weight - lastWeight : null;
      return (
        <Shell
          id={id}
          emoji={habit.emoji}
          label={habit.label}
          state={done ? 'done' : undefined}
          meta={
            <>
              {lastWeight != null && (
                <Hint>
                  last {lastWeight} {settings.weightUnit}
                  {delta != null && delta !== 0 && ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)})`}
                </Hint>
              )}
              <StreakTag streak={streak} />
            </>
          }
          right={
            <NumberInput
              w={112}
              size="sm"
              inputMode="decimal"
              placeholder={lastWeight ? String(lastWeight) : settings.weightUnit}
              suffix={` ${settings.weightUnit}`}
              decimalScale={1}
              min={0}
              max={400}
              hideControls
              value={log?.weight ?? ''}
              onChange={(v) =>
                set((l) => {
                  l.weight = typeof v === 'number' ? v : null;
                })
              }
            />
          }
        />
      );
    }

    case 'dose': {
      const ml = log?.finMl ?? null;
      // % w/v → mg per ml: 0.025% = 0.025 g / 100 ml = 0.25 mg/ml
      const mgPerMl = settings.finConcentration * 10;
      return (
        <Shell
          id={id}
          emoji={habit.emoji}
          label={habit.label}
          state={done ? 'done' : undefined}
          onClick={(e) => {
            if (!done) pop(e);
            set((l) => {
              l.finMl = done ? null : settings.finTargetMl;
            });
          }}
          meta={
            <>
              <Hint>
                {settings.finConcentration}% · {ml ? `${(ml * mgPerMl).toFixed(3)} mg` : `target ${settings.finTargetMl} ml`}
              </Hint>
              <StreakTag streak={streak} />
            </>
          }
          right={
            <Group gap={8} wrap="nowrap" onClick={stop}>
              {done && (
                <NumberInput
                  w={92}
                  size="sm"
                  inputMode="decimal"
                  suffix=" ml"
                  step={0.1}
                  decimalScale={2}
                  min={0}
                  max={10}
                  value={ml ?? ''}
                  onChange={(v) =>
                    set((l) => {
                      l.finMl = typeof v === 'number' ? v : null;
                    })
                  }
                />
              )}
              <div
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  if (!done) pop(e);
                  set((l) => {
                    l.finMl = done ? null : settings.finTargetMl;
                  });
                }}
              >
                <Checkbox.Indicator checked={done} size="lg" radius="xl" color="teal" />
              </div>
            </Group>
          }
        />
      );
    }

    case 'avoid': {
      const answer = log?.avoid?.[id];
      const choose = (value: 'clean' | 'slip', e: MouseEvent) => {
        const next = answer === value ? undefined : value;
        if (next === 'clean') pop(e);
        if (next === 'slip') {
          notifications.show({
            color: 'gray',
            title: 'Logged. Honesty beats streaks.',
            message: 'Tomorrow is a fresh start — be better than today.',
          });
        }
        set((l) => {
          const avoid = { ...l.avoid };
          if (next) avoid[id] = next;
          else delete avoid[id];
          l.avoid = avoid;
        });
      };
      return (
        <Shell
          id={id}
          emoji={habit.emoji}
          label={habit.label}
          state={answer === 'clean' ? 'done' : answer === 'slip' ? 'missed' : undefined}
          meta={baseMeta}
          right={
            <Group gap={4} wrap="nowrap">
              <Button
                size="compact-sm"
                radius="xl"
                variant={answer === 'clean' ? 'filled' : 'default'}
                color="teal"
                onClick={(e) => choose('clean', e)}
              >
                Clean
              </Button>
              <Button
                size="compact-sm"
                radius="xl"
                variant={answer === 'slip' ? 'filled' : 'default'}
                color="red"
                onClick={(e) => choose('slip', e)}
              >
                Slipped
              </Button>
            </Group>
          }
        />
      );
    }
  }
}
