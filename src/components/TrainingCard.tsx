import { Badge, Card, Chip, Group, Stack, Text } from '@mantine/core';
import { WORKOUTS } from '../lib/config';
import { pop } from '../lib/celebrate';
import { addDays, weekday, weekStart, type DateKey } from '../lib/dates';
import type { Streak } from '../lib/engine';
import { updateDay, useApp } from '../lib/store';
import type { WorkoutType } from '../lib/types';
import { floatXp } from '../lib/feedback';
import { ScoreRing } from './ui';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function TrainingCard({ date, streak }: { date: DateKey; streak: Streak }) {
  const days = useApp((s) => s.days);
  const target = useApp((s) => s.settings.workoutTarget);
  const workouts = days[date]?.workouts ?? [];
  const ws = weekStart(date);
  const week = LETTERS.map((_, i) => addDays(ws, i));
  const sessions = week.filter((d) => (days[d]?.workouts?.length ?? 0) > 0).length;
  const hit = sessions >= target;

  return (
    <Card id="training" p="sm" style={hit ? { borderColor: 'var(--mantine-color-teal-outline)' } : undefined}>
      <Group justify="space-between" wrap="nowrap" px={4}>
        <Group gap="sm" wrap="nowrap">
          <ScoreRing value={Math.min(100, (sessions / target) * 100)} size={42} stroke={4} color={hit ? 'teal' : 'violet'}>
            <Text fz={18}>{hit ? '💪' : '🏋️'}</Text>
          </ScoreRing>
          <div>
            <Text fw={800} fz={17} lh={1.2}>
              Training
            </Text>
            <Text size="xs" c="dimmed">
              {hit ? 'Weekly target smashed' : `${target - sessions} more this week`}
            </Text>
          </div>
        </Group>
        <Stack gap={2} align="flex-end" style={{ flexShrink: 0 }}>
          <Badge size="lg" variant={hit ? 'filled' : 'light'} color={hit ? 'teal' : 'gray'}>
            {sessions}/{target}
          </Badge>
          {streak.current >= 1 && (
            <Text size="xs" fw={800} c="orange.4">
              <span className="flame">🔥</span> {streak.current} wk
            </Text>
          )}
        </Stack>
      </Group>

      <Chip.Group
        multiple
        value={workouts}
        onChange={(v) => {
          const added = WORKOUTS.find((w) => v.includes(w.id) && !workouts.includes(w.id));
          if (added) {
            pop();
            floatXp(undefined, `+${added.points}`);
          }
          updateDay(date, (l) => {
            l.workouts = v as WorkoutType[];
          });
        }}
      >
        <Group gap={6} mt="sm" px={4}>
          {WORKOUTS.map((w) => (
            <Chip key={w.id} value={w.id} color="teal" variant="light" radius="xl" size="sm">
              {w.emoji} {w.label}
              <Text span size="xs" c="dimmed" ml={4}>
                +{w.points}
              </Text>
            </Chip>
          ))}
        </Group>
      </Chip.Group>

      <Group gap={4} mt="md" px={4} justify="space-between" wrap="nowrap">
        {week.map((d, i) => {
          const trained = (days[d]?.workouts?.length ?? 0) > 0;
          return (
            <Stack key={d} gap={3} align="center" style={{ flex: 1 }}>
              <Text fz={10} c={d === date ? undefined : 'dimmed'} fw={d === date ? 900 : 600}>
                {LETTERS[i]}
              </Text>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  color: 'white',
                  background: trained ? 'linear-gradient(135deg, var(--mantine-color-teal-4), var(--mantine-color-green-6))' : 'var(--ring-track)',
                  outline: d === date ? '2px solid var(--mantine-color-violet-5)' : undefined,
                  outlineOffset: 2,
                }}
              >
                {trained ? '✓' : ''}
              </div>
            </Stack>
          );
        })}
      </Group>

      {weekday(date) === 1 && (
        <Text size="xs" c="dimmed" mt="sm" px={4}>
          ⚽ Football Monday — optional. If you go, it counts and no gym needed today.
        </Text>
      )}
    </Card>
  );
}
