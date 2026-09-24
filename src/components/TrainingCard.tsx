import { Badge, Card, Chip, Group, RingProgress, Stack, Text } from '@mantine/core';
import { WORKOUTS } from '../lib/config';
import { pop } from '../lib/celebrate';
import { addDays, weekday, weekStart, type DateKey } from '../lib/dates';
import type { Streak } from '../lib/engine';
import { updateDay, useApp } from '../lib/store';
import type { WorkoutType } from '../lib/types';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function TrainingCard({ date, streak }: { date: DateKey; streak: Streak }) {
  const days = useApp((s) => s.days);
  const target = useApp((s) => s.settings.workoutTarget);
  const workouts = days[date]?.workouts ?? [];
  const ws = weekStart(date);
  const week = LETTERS.map((_, i) => addDays(ws, i));
  const sessions = week.filter((d) => (days[d]?.workouts?.length ?? 0) > 0).length;
  const hit = sessions >= target;
  const isMonday = weekday(date) === 1;

  return (
    <Card p="sm" style={hit ? { borderColor: 'var(--mantine-color-teal-outline)' } : undefined}>
      <Group justify="space-between" wrap="nowrap" px={4}>
        <Group gap="sm" wrap="nowrap">
          <RingProgress
            size={52}
            thickness={5}
            roundCaps
            sections={[{ value: Math.min(100, (sessions / target) * 100), color: hit ? 'teal' : 'violet' }]}
            label={
              <Text ta="center" fz={18}>
                {hit ? '💪' : '🏋️'}
              </Text>
            }
          />
          <div>
            <Text fw={800} lh={1.2}>
              Training
            </Text>
            <Text size="xs" c="dimmed">
              {hit ? 'Weekly target smashed' : `${target - sessions} more this week — gym counts most`}
            </Text>
          </div>
        </Group>
        <Stack gap={2} align="flex-end" style={{ flexShrink: 0 }}>
          <Badge size="lg" variant={hit ? 'filled' : 'light'} color={hit ? 'teal' : 'gray'}>
            {sessions}/{target}
          </Badge>
          {streak.current >= 1 && (
            <Text size="xs" fw={700} c="orange.4">
              <span className="flame">🔥</span> {streak.current} wk
            </Text>
          )}
        </Stack>
      </Group>

      <Chip.Group
        multiple
        value={workouts}
        onChange={(v) => {
          if (v.length > workouts.length) pop();
          updateDay(date, (l) => {
            l.workouts = v as WorkoutType[];
          });
        }}
      >
        <Group gap={6} mt="sm" px={4}>
          {WORKOUTS.map((w) => (
            <Chip key={w.id} value={w.id} color="teal" variant="light" radius="md">
              {w.emoji} {w.label} <Text span size="xs" c="dimmed" ml={4}>+{w.points}</Text>
            </Chip>
          ))}
        </Group>
      </Chip.Group>

      <Group gap={6} mt="sm" px={4} justify="space-between">
        {week.map((d, i) => {
          const trained = (days[d]?.workouts?.length ?? 0) > 0;
          return (
            <Stack key={d} gap={2} align="center" style={{ flex: 1 }}>
              <Text size="10px" c="dimmed" fw={d === date ? 800 : 500}>
                {LETTERS[i]}
              </Text>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 99,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  background: trained ? 'var(--mantine-color-teal-filled)' : 'var(--mantine-color-default)',
                  outline: d === date ? '2px solid var(--mantine-color-violet-5)' : undefined,
                }}
              >
                {trained ? '✓' : ''}
              </div>
            </Stack>
          );
        })}
      </Group>

      {isMonday && (
        <Text size="xs" c="dimmed" mt="sm" px={4}>
          ⚽ Football Monday — optional. If you go, it counts as a session and no gym needed today.
        </Text>
      )}
    </Card>
  );
}
