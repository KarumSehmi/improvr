import { Badge, Card, Group, Progress, RingProgress, RollingNumber, Stack, Text } from '@mantine/core';
import { QUOTE } from '../lib/config';
import { fmt, type DateKey } from '../lib/dates';
import { grade, type DayEval, type Summary } from '../lib/engine';

interface Props {
  date: DateKey;
  evaluation: DayEval | undefined;
  summary: Summary;
  name: string;
}

export default function HeroCard({ date, evaluation: e, summary, name }: Props) {
  const pct = e?.pct ?? 0;
  const g = grade(e?.pct ?? null);
  // Only hand out a grade once the day is locked in — a big "F" at 8am helps nobody.
  const showGrade = !!e?.closed || !!e?.dayOff;
  const { level, logStreak, habitStreaks } = summary;
  const vape = habitStreaks.vape?.current ?? 0;
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late one' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

  return (
    <Card p="md" radius="xl" className="hero">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" lts={1}>
            {greeting}
            {name ? `, ${name}` : ''}
          </Text>
          <Text fw={900} fz={26} lh={1.1}>
            {fmt(date, 'dddd')}
          </Text>
          <Text c="dimmed" size="sm">
            {fmt(date, 'D MMMM YYYY')}
          </Text>
        </div>
        <Badge size="lg" variant="gradient" radius="md">
          Lvl {level.level} · {level.title}
        </Badge>
      </Group>

      <Text size="sm" fs="italic" mt="xs" c="violet.2">
        “{QUOTE}”
      </Text>

      <Group mt="md" wrap="nowrap" gap="md">
        <RingProgress
          size={104}
          thickness={10}
          roundCaps
          sections={pct > 0 || e?.dayOff ? [{ value: e?.dayOff ? 100 : pct, color: e?.dayOff ? 'blue' : pct >= 100 ? 'teal' : 'violet' }] : []}
          label={
            <Stack gap={0} align="center">
              {showGrade ? (
                <Text fw={900} fz={22} lh={1} c={`${g.color}.4`}>
                  {g.letter}
                </Text>
              ) : (
                <Text fw={900} fz={20} lh={1}>
                  {pct}%
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {e?.dayOff ? 'day off' : showGrade ? `${pct}%` : `${e?.completed ?? 0}/${e?.required ?? 0} done`}
              </Text>
            </Stack>
          }
        />
        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={4} align="baseline">
            <Text fw={900} fz={28} lh={1} c="yellow.4">
              +
            </Text>
            <RollingNumber value={e?.points ?? 0} fw={900} fz={28} lh={1} c="yellow.4" />
            <Text size="sm" c="dimmed">
              XP
            </Text>
          </Group>
          <Group gap={6}>
            <Badge size="lg" variant="light" color="orange" leftSection={<span className="flame">🔥</span>}>
              {logStreak.current} day{logStreak.current === 1 ? '' : 's'}
            </Badge>
            <Badge size="lg" variant="light" color="teal" leftSection="🚭">
              {vape} vape-free
            </Badge>
          </Group>
        </Stack>
      </Group>

      <Stack gap={4} mt="md">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Level {level.level} → {level.level + 1}
          </Text>
          <Text size="xs" c="dimmed">
            {level.into} / {level.need} XP
          </Text>
        </Group>
        <Progress value={(level.into / level.need) * 100} size="md" radius="xl" color="yellow" striped animated />
      </Stack>
    </Card>
  );
}
