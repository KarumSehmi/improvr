import { Badge, Card, Group, Progress, RollingNumber, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import { QUOTE, type Habit } from '../lib/config';
import { fmt, type DateKey } from '../lib/dates';
import { grade, type DayEval, type Summary } from '../lib/engine';
import { goTo } from '../lib/hooks';
import { ScoreRing } from './ui';

interface Props {
  date: DateKey;
  isToday: boolean;
  evaluation: DayEval;
  yesterdayPct: number | null;
  summary: Summary;
  name: string;
  focus: { habit: Habit; done: number; required: number } | null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

function Pill({ emoji, children, color }: { emoji: string; children: ReactNode; color: string }) {
  return (
    <Badge size="lg" variant="light" color={color} radius="xl" leftSection={emoji} styles={{ root: { flexShrink: 0, textTransform: 'none', fontWeight: 700 } }}>
      {children}
    </Badge>
  );
}

export default function HeroCard({ date, isToday, evaluation: e, yesterdayPct, summary, name, focus }: Props) {
  const pct = e.pct ?? 0;
  const g = grade(e.pct);
  const { level, logStreak, habitStreaks, trainingStreak } = summary;
  const vape = habitStreaks.vape;
  const beating = yesterdayPct != null && pct > yesterdayPct;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{fmt(date, 'dddd D MMMM')}</div>
          <Title order={1} fz={28} lh={1.15} mt={2}>
            {isToday ? `${greeting()}${name ? `, ${name}` : ''}` : fmt(date, 'dddd')}
          </Title>
        </div>
        <UnstyledButton onClick={() => goTo('progress')} aria-label="Level">
          <ScoreRing value={(level.into / level.need) * 100} size={56} stroke={5} color="teal">
            <Stack gap={0} align="center">
              <Text fz={9} fw={800} c="dimmed" lh={1}>
                LVL
              </Text>
              <Text fz={18} fw={900} lh={1}>
                {level.level}
              </Text>
            </Stack>
          </ScoreRing>
        </UnstyledButton>
      </Group>

      <Card className="hero" p="lg">
        <Group wrap="nowrap" gap="lg" align="center">
          <ScoreRing value={e.dayOff ? 100 : pct} marker={e.dayOff ? null : yesterdayPct} size={124} stroke={12} color={e.dayOff ? 'blue' : pct >= 100 ? 'teal' : 'violet'}>
            <Stack gap={0} align="center">
              <Text fz={30} fw={900} lh={1}>
                {e.dayOff ? '🏖️' : `${pct}%`}
              </Text>
              <Text size="xs" c="dimmed" fw={600} mt={4}>
                {e.dayOff ? 'day off' : e.closed ? `grade ${g.letter}` : `${e.completed}/${e.required} done`}
              </Text>
            </Stack>
          </ScoreRing>

          <Stack gap={8} style={{ flex: 1, minWidth: 0 }}>
            <div>
              <div className="eyebrow">XP {isToday ? 'today' : 'this day'}</div>
              <Group gap={2} align="baseline" wrap="nowrap">
                <Text fw={900} fz={32} lh={1.1} c="yellow.4">
                  +
                </Text>
                <RollingNumber value={e.points} fw={900} fz={32} lh={1.1} c="yellow.4" />
              </Group>
            </div>
            {!e.dayOff && yesterdayPct != null && (
              <Text size="sm" fw={700} c={beating ? 'teal.4' : undefined}>
                {beating ? '✓ Better than yesterday' : (
                  <>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: 'var(--mantine-color-yellow-4)', marginRight: 6 }} />
                    Beat yesterday: {yesterdayPct}%
                  </>
                )}
              </Text>
            )}
            <div>
              <Progress value={(level.into / level.need) * 100} size={6} radius="xl" color="yellow" />
              <Text size="xs" c="dimmed" mt={4} truncate>
                Lvl {level.level} {level.title} · {level.need - level.into} XP to go
              </Text>
            </div>
          </Stack>
        </Group>

        <Text size="sm" fs="italic" mt="md" c="dimmed">
          “{QUOTE}”
        </Text>

        <div className="pill-row" style={{ marginTop: 12 }}>
          <Pill emoji="🔥" color="orange">
            {logStreak.current}-day streak
          </Pill>
          {vape && (
            <Pill emoji="🚭" color="teal">
              {vape.current} vape-free
            </Pill>
          )}
          <Pill emoji="💪" color="grape">
            {trainingStreak.current} wk gym
          </Pill>
          {focus && (
            <Pill emoji="🎯" color="pink">
              {focus.habit.label} {focus.done}/{focus.required}
            </Pill>
          )}
        </div>
      </Card>
    </Stack>
  );
}
