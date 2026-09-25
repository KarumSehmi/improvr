import { Badge, Card, Group, Progress, RollingNumber, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { QUOTE, type Habit } from '../lib/config';
import { addDays, fmt, type DateKey } from '../lib/dates';
import { grade, totalSaved, type DayEval, type Summary } from '../lib/engine';
import { goTo, useNow } from '../lib/hooks';
import { dayProgress, daypart, hatTrickStreak, logicalNow, pace, type Daypart } from '../lib/moments';
import CheckinStrip from './Checkins';
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

const GREETING: Record<Daypart, [emoji: string, text: string]> = {
  dawn: ['🌄', 'Early start'],
  morning: ['🌅', 'Morning'],
  day: ['☀️', 'Afternoon'],
  evening: ['🌆', 'Evening'],
  night: ['🌙', 'Evening'],
};

function Pill({ emoji, children, color }: { emoji: string; children: ReactNode; color: string }) {
  return (
    <Badge size="lg" variant="light" color={color} radius="xl" leftSection={emoji} styles={{ root: { flexShrink: 0, textTransform: 'none', fontWeight: 700 } }}>
      {children}
    </Badge>
  );
}

/** You vs yesterday-you at this exact time of day. */
function Race({ you, them, final, total }: { you: number; them: number; final: number; total: number }) {
  const diff = you - them;
  const max = Math.max(total, final, you, 1);
  return (
    <div>
      <Text size="sm" fw={800} c={diff > 0 ? 'teal.4' : diff < 0 ? 'orange.4' : undefined} lh={1.25}>
        {diff > 0 ? `⚡ ${diff} ahead of yesterday` : diff < 0 ? `🏃 ${-diff} behind yesterday` : '🤝 Level with yesterday'}
      </Text>
      <div className="race">
        {[
          ['you', 'You', you],
          ['them', 'Yday', them],
        ].map(([who, label, n]) => (
          <div key={who} className="race-row">
            <span>{label}</span>
            <div className="race-track">
              <motion.div className="race-fill" data-who={who} initial={false} animate={{ width: `${((n as number) / max) * 100}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
            </div>
            <b>{n}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeroCard({ date, isToday, evaluation: e, yesterdayPct, summary, name, focus }: Props) {
  const now = useNow();
  const clock = new Date(now);
  const part = daypart(clock);
  const live = logicalNow(clock).date === date;
  const pct = e.pct ?? 0;
  const g = grade(e.pct);
  const { level, logStreak, habitStreaks, trainingStreak } = summary;
  const vape = habitStreaks.vape;
  const saved = totalSaved(summary);
  const hatTricks = hatTrickStreak(summary.evals);
  const race = live && !e.dayOff ? pace(e, summary.evalByDate[addDays(date, -1)], now) : null;
  // The yellow notch is yesterday-you: where they were by now (or their final score).
  const marker = e.dayOff ? null : race && e.required ? Math.min(100, (race.them / e.required) * 100) : yesterdayPct;
  const beating = yesterdayPct != null && pct > yesterdayPct;

  // The sun (moon at night) arcs across the card through the day.
  const p = dayProgress(clock);
  const sun = { left: `${8 + p * 84}%`, top: `${58 - Math.sin(Math.PI * p) * 48}%` };
  const [emoji, hello] = clock.getHours() < 4 ? ['🦉', 'Still up'] : GREETING[part];
  const greet = isToday || live;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">
            {greet ? `${emoji} ` : ''}
            {fmt(date, 'dddd D MMMM')}
          </div>
          <Title order={1} fz={28} lh={1.15} mt={2}>
            {greet ? `${hello}${name ? `, ${name}` : ''}` : fmt(date, 'dddd')}
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
        {live && <div className="hero-sun" style={sun} />}
        {live && part === 'night' && <div className="hero-stars" />}

        <Group wrap="nowrap" gap="lg" align="center">
          <ScoreRing value={e.dayOff ? 100 : pct} marker={marker} size={120} stroke={12} color={e.dayOff ? 'blue' : pct >= 100 ? 'teal' : 'violet'}>
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
              <div className="eyebrow">XP {isToday || live ? 'today' : 'this day'}</div>
              <Group gap={2} align="baseline" wrap="nowrap">
                <Text fw={900} fz={30} lh={1.1} c="var(--xp)">
                  +
                </Text>
                <RollingNumber value={e.points} fw={900} fz={30} lh={1.1} c="var(--xp)" />
              </Group>
            </div>
            {race ? (
              <Race you={race.you} them={race.them} final={race.final} total={e.required} />
            ) : (
              !e.dayOff &&
              yesterdayPct != null && (
                <Text size="sm" fw={700} c={beating ? 'teal.4' : undefined}>
                  {beating ? (
                    '✓ Better than yesterday'
                  ) : (
                    <>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: 'var(--mantine-color-yellow-4)', marginRight: 6 }} />
                      Beat yesterday: {yesterdayPct}%
                    </>
                  )}
                </Text>
              )
            )}
            <div>
              <Progress value={(level.into / level.need) * 100} size={5} radius="xl" color="yellow" />
              <Group justify="space-between" gap={4} mt={4} wrap="nowrap">
                <Text size="xs" fw={700} truncate>
                  {level.title}
                </Text>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  {(level.need - level.into).toLocaleString()} to Lvl {level.level + 1}
                </Text>
              </Group>
            </div>
          </Stack>
        </Group>

        {(live || e.checkins > 0) && (
          <div style={{ marginTop: 16 }}>
            <CheckinStrip date={date} log={e.log} />
          </div>
        )}

        <div className="pill-row" style={{ marginTop: 14 }}>
          <Pill emoji="🔥" color="orange">
            {logStreak.current}-day streak
          </Pill>
          {vape && (
            <Pill emoji="🚭" color="teal">
              {vape.current} nicotine-free
            </Pill>
          )}
          {saved != null && saved > 0 && (
            <Pill emoji="💰" color="green">
              £{saved} saved
            </Pill>
          )}
          {hatTricks >= 2 && (
            <Pill emoji="🎯" color="yellow">
              {hatTricks}-day hat-trick
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

        <Text size="xs" fs="italic" mt="sm" c="dimmed">
          “{QUOTE}”
        </Text>
      </Card>
    </Stack>
  );
}
