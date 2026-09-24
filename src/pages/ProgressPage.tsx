import { BarChart, Heatmap } from '@mantine/charts';
import {
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Timeline,
  Title,
  useComputedColorScheme,
} from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { achievements } from '../lib/achievements';
import { addDays, fmt, maxKey, relativeDay, weekStart } from '../lib/dates';
import { completionRate, grade, slipStats, weekStats, type Summary } from '../lib/engine';
import { useSummary, useToday, useUi } from '../lib/hooks';
import { insights } from '../lib/insights';
import { averageClock, formatDuration, sleepMinutes } from '../lib/sleep';
import { SCORE_COLORS } from '../lib/scoreColors';
import { useApp } from '../lib/store';
import { Tile } from '../components/ui';

function StatTile({ emoji, value, label, sub }: { emoji: string; value: string | number; label: string; sub?: string }) {
  return (
    <Card p="sm">
      <Text fz={22}>{emoji}</Text>
      <Text fw={900} fz={28} lh={1.1}>
        {value}
      </Text>
      <Text size="xs" fw={600}>
        {label}
      </Text>
      {sub && (
        <Text size="xs" c="dimmed">
          {sub}
        </Text>
      )}
    </Card>
  );
}


function ScoreHeatmap({ summary }: { summary: Summary }) {
  const today = useToday();
  const scheme = useComputedColorScheme('dark');
  const scroller = useRef<HTMLDivElement>(null);
  // Start scrolled to the most recent weeks.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, []);
  const data: Record<string, number> = {};
  for (const e of summary.evals) if (e.pct != null) data[e.date] = e.pct;
  const start = maxKey(addDays(today, -181), addDays(summary.evals[0]?.date ?? today, -14));
  return (
    <Card p="sm">
      <Text fw={800} px={4}>
        Daily score
      </Text>
      <Text size="xs" c="dimmed" px={4} mb="xs">
        Stronger colour = more of your list done. Tap a square for the score.
      </Text>
      <div className="scroll-x" ref={scroller}>
        <div style={{ width: 'max-content' }}>
          <Heatmap
            data={data}
            startDate={start}
            endDate={today}
            domain={[0, 100]}
            colors={SCORE_COLORS[scheme]}
            rectSize={14}
            gap={3}
            rectRadius={3}
            withMonthLabels
            withWeekdayLabels
            weekdayLabels={['', 'Mon', '', 'Wed', '', 'Fri', '']}
            withTooltip
            withOutsideDates={false}
            getTooltipLabel={({ date, value }) => `${fmt(date, 'ddd D MMM')} — ${value == null ? 'no score' : `${value}%`}`}
          />
        </div>
      </div>
    </Card>
  );
}

function CleanCard({ summary }: { summary: Summary }) {
  const stats = slipStats(summary);
  return (
    <Card p="sm">
      <Text fw={800} px={4}>
        🛡️ Staying clean
      </Text>
      <Text size="xs" c="dimmed" px={4} mb="sm">
        How often you slip — the honest numbers.
      </Text>
      <Stack gap="sm">
        {stats.map((s) => {
          const streak = summary.habitStreaks[s.habit.id];
          return (
            <Card key={s.habit.id} p="sm" radius="md" bg="var(--mantine-color-default)">
              <Group justify="space-between" wrap="nowrap">
                <Text fw={700}>
                  {s.habit.emoji} {s.habit.label}
                </Text>
                <Badge size="lg" color="orange" variant="light" leftSection={<span className="flame">🔥</span>}>
                  {streak.current}d
                </Badge>
              </Group>
              <SimpleGrid cols={4} mt="xs" spacing={4}>
                <div>
                  <Text fw={800}>{s.slips7}</Text>
                  <Text size="10px" c="dimmed">
                    slips 7d
                  </Text>
                </div>
                <div>
                  <Text fw={800}>{s.slips30}</Text>
                  <Text size="10px" c="dimmed">
                    slips 30d
                  </Text>
                </div>
                <div>
                  <Text fw={800}>{streak.best}d</Text>
                  <Text size="10px" c="dimmed">
                    best streak
                  </Text>
                </div>
                <div>
                  <Text fw={800}>{s.daysSinceSlip ?? '—'}</Text>
                  <Text size="10px" c="dimmed">
                    days since slip
                  </Text>
                </div>
              </SimpleGrid>
              {(s.urgesAll > 0 || s.saved != null) && (
                <Group gap="md" mt={6}>
                  {s.urgesAll > 0 && (
                    <Text size="xs" fw={600} c="grape.3">
                      💪 {s.urges7} urges beaten this week ({s.urgesAll} total)
                    </Text>
                  )}
                  {s.saved != null && (
                    <Text size="xs" fw={600} c="teal.4">
                      💰 £{s.saved} saved{s.savedSinceSlip != null && s.savedSinceSlip !== s.saved ? ` · £${s.savedSinceSlip} since last slip` : ''}
                    </Text>
                  )}
                </Group>
              )}
            </Card>
          );
        })}
      </Stack>
    </Card>
  );
}

function StreakTable({ summary }: { summary: Summary }) {
  const rows = summary.habits.filter((h) => h.kind !== 'avoid').map((h) => ({
    h,
    streak: summary.habitStreaks[h.id],
    rate: completionRate(summary, h.id, 30),
  }));
  return (
    <Card p="sm">
      <Text fw={800} px={4} mb="xs">
        🔥 Habit streaks
      </Text>
      <Table verticalSpacing={6} horizontalSpacing={6}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Habit</Table.Th>
            <Table.Th ta="right">Now</Table.Th>
            <Table.Th ta="right">Best</Table.Th>
            <Table.Th w={90}>30 days</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ h, streak, rate }) => (
            <Table.Tr key={h.id}>
              <Table.Td>
                <Text size="sm" lineClamp={1}>
                  {h.emoji} {h.label}
                </Text>
              </Table.Td>
              <Table.Td ta="right" fw={700}>
                {streak.current}
              </Table.Td>
              <Table.Td ta="right" c="dimmed">
                {streak.best}
              </Table.Td>
              <Table.Td>
                {rate == null ? (
                  <Text size="xs" c="dimmed">
                    —
                  </Text>
                ) : (
                  <Group gap={4} wrap="nowrap">
                    <Progress value={rate} size="sm" style={{ flex: 1 }} color="violet" />
                    <Text size="xs" w={30} ta="right">
                      {rate}%
                    </Text>
                  </Group>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

function TrainingChart({ summary }: { summary: Summary }) {
  const target = useApp((s) => s.settings.workoutTarget);
  const data = summary.weeks.slice(-12).map((w) => ({ week: fmt(w.start, 'D MMM'), sessions: w.sessions }));
  const hitWeeks = summary.weeks.filter((w) => w.outcome === 'success').length;
  return (
    <Card p="sm">
      <Text fw={800} px={4}>
        🏋️ Sessions per week
      </Text>
      <Text size="xs" c="dimmed" px={4}>
        Hit {target}+ in {hitWeeks} week{hitWeeks === 1 ? '' : 's'} · current run {summary.trainingStreak.current} · best {summary.trainingStreak.best}
      </Text>
      <BarChart
        mt="md"
        h={180}
        data={data}
        dataKey="week"
        series={[{ name: 'sessions', label: 'Sessions', color: 'teal.5' }]}
        referenceLines={[{ y: target, label: `Target ${target}`, color: 'gray.6' }]}
        yAxisProps={{ allowDecimals: false, domain: [0, Math.max(target + 1, ...data.map((d) => d.sessions))], width: 24 }}
        gridAxis="x"
        tickLine="none"
        barProps={{ radius: [4, 4, 0, 0] }}
        maxBarWidth={28}
      />
    </Card>
  );
}

function BodyCard({ summary }: { summary: Summary }) {
  const settings = useApp((s) => s.settings);
  const last30 = summary.evals.slice(-30);
  const lateNights = last30.filter((e) => e.log?.done?.sleep === false);
  const lateWakes = last30.filter((e) => e.log?.done?.wake === false);
  const finDays = last30.filter((e) => (e.log?.finMl ?? 0) > 0);
  const finTotalMl = finDays.reduce((s, e) => s + (e.log?.finMl ?? 0), 0);
  const avgMl = finDays.length ? finTotalMl / finDays.length : 0;
  const mgPerMl = settings.finConcentration * 10;
  // Apple Watch nights (only if the Shortcut is set up)
  const watched = last30.map((e) => e.log?.sleepAuto).filter((s): s is NonNullable<typeof s> => !!s);
  const avgSleep = watched.length ? watched.reduce((sum, s) => sum + sleepMinutes(s.asleep, s.awake), 0) / watched.length : null;
  return (
    <SimpleGrid cols={{ base: 2, sm: avgSleep != null ? 3 : 4 }} spacing="sm">
      {avgSleep != null && (
        <>
          <StatTile emoji="⌚" value={formatDuration(avgSleep)} label="Average sleep" sub={`${watched.length} night${watched.length === 1 ? '' : 's'} from your Watch`} />
          <StatTile
            emoji="🛏️"
            value={averageClock(watched.map((s) => s.asleep)) ?? '—'}
            label="Average bedtime"
            sub={`up around ${averageClock(watched.map((s) => s.awake))}`}
          />
        </>
      )}
      <StatTile emoji="🌙" value={lateNights.length} label="Nights after 1am" sub="last 30 days" />
      <StatTile emoji="⏰" value={lateWakes.length} label="Up after 9am" sub="last 30 days" />
      <StatTile emoji="💧" value={`${finDays.length}/${last30.length}`} label="Finasteride days" sub={`avg ${avgMl.toFixed(2)} ml · ${(avgMl * mgPerMl).toFixed(3)} mg`} />
      <StatTile emoji="🚰" value={last30.filter((e) => (e.log?.water ?? 0) >= 2).length} label="Water target days" sub="last 30 days" />
    </SimpleGrid>
  );
}

function NotesCard({ summary }: { summary: Summary }) {
  const today = useToday();
  const notes = summary.evals.filter((e) => e.log?.note?.trim()).slice(-15).reverse();
  if (!notes.length) return null;
  return (
    <Card p="sm">
      <Text fw={800} px={4} mb="sm">
        📝 Notes to self
      </Text>
      <Timeline bulletSize={14} lineWidth={2} active={notes.length}>
        {notes.map((e) => (
          <Timeline.Item key={e.date} title={<Text size="xs" c="dimmed">{relativeDay(e.date, today)}</Text>}>
            <Text size="sm">{e.log?.note}</Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
}

export default function ProgressPage() {
  const summary = useSummary();
  const { level, totalXp, logStreak, evals } = summary;
  const perfectDays = evals.filter((e) => e.perfect).length;
  const scored = evals.filter((e) => e.pct != null && e.closed);
  const avg = scored.length ? Math.round(scored.reduce((s, e) => s + (e.pct ?? 0), 0) / scored.length) : 0;
  const vape = summary.habitStreaks.vape ?? { current: 0, best: 0 };

  return (
    <Stack>
      <Title order={2}>Progress</Title>

      <Card p="md" radius="xl" className="hero">
        <Group justify="space-between">
          <div>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed" lts={1}>
              Level {level.level}
            </Text>
            <Text fw={900} fz={26}>
              {level.title}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text fw={900} fz={26} c="yellow.4">
              {totalXp.toLocaleString()}
            </Text>
            <Text size="xs" c="dimmed">
              total XP
            </Text>
          </div>
        </Group>
        <Progress mt="sm" value={(level.into / level.need) * 100} size="lg" radius="xl" color="yellow" striped animated />
        <Text size="xs" c="dimmed" mt={4}>
          {level.need - level.into} XP to level {level.level + 1}
        </Text>
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
        <StatTile emoji="🔥" value={logStreak.current} label="Days logged in a row" sub={`best ${logStreak.best}`} />
        <StatTile emoji="🚭" value={vape.current} label="Days vape-free" sub={`best ${vape.best}`} />
        <StatTile emoji="🏆" value={perfectDays} label="Perfect days" />
        <StatTile emoji="📊" value={`${avg}%`} label="Average score" sub={`${scored.length} days logged`} />
        <StatTile emoji="💪" value={summary.trainingStreak.current} label="Weeks hitting gym target" sub={`best ${summary.trainingStreak.best}`} />
        <StatTile emoji="💷" value={`£${summary.fineTotal}`} label="Total fines" sub={summary.owed ? `£${summary.owed} still owed` : 'all paid up'} />
      </SimpleGrid>

      <InsightsCard summary={summary} />
      <WeekCard summary={summary} />
      <ScoreHeatmap summary={summary} />
      <AchievementsCard summary={summary} />
      <CleanCard summary={summary} />
      <StreakTable summary={summary} />
      <TrainingChart summary={summary} />
      <BodyCard summary={summary} />
      <NotesCard summary={summary} />
    </Stack>
  );
}

function InsightsCard({ summary }: { summary: Summary }) {
  const list = useMemo(() => insights(summary), [summary]);
  return (
    <Card p="sm">
      <Text fw={800} fz={17} px={4}>
        🧠 What your data says
      </Text>
      {list.length === 0 ? (
        <Text size="sm" c="dimmed" px={4} mt={4}>
          Log a couple of weeks and patterns show up here — like how your sleep affects the rest of your day, and when you tend to slip.
        </Text>
      ) : (
        <div style={{ marginTop: 4 }}>
          {list.slice(0, 6).map((i) => (
            <div key={i.id} className="hrow">
              <div className="hrow-main">
                <Tile emoji={i.emoji} color={i.tone === 'good' ? 'teal' : i.tone === 'bad' ? 'orange' : 'violet'} />
                <Text size="sm" fw={600} lh={1.35} style={{ flex: 1 }}>
                  {i.text}
                </Text>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Change({ now, before, suffix = '', invert }: { now: number | null; before: number | null; suffix?: string; invert?: boolean }) {
  if (now == null || before == null) return <Text size="xs" c="dimmed">no data last week</Text>;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) return <Text size="xs" c="dimmed">same as last week</Text>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <Text size="xs" fw={800} c={good ? 'teal.4' : 'red.4'}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}
      {suffix} vs last week
    </Text>
  );
}

function WeekCard({ summary }: { summary: Summary }) {
  const today = useToday();
  const ws = weekStart(today);
  // Like for like: this week so far vs the same days last week. Scores only count finished days.
  const now = weekStats(summary, ws, today);
  const before = weekStats(summary, addDays(ws, -7), addDays(today, -7));
  const finished = weekStats(summary, ws, addDays(today, -1)).avgPct;
  const finishedBefore = weekStats(summary, addDays(ws, -7), addDays(today, -8)).avgPct;
  const g = grade(finished);
  const slipsNow = Object.values(now.slips).reduce((a, b) => a + b, 0);
  const slipsBefore = Object.values(before.slips).reduce((a, b) => a + b, 0);
  return (
    <Card p="sm">
      <Group justify="space-between" px={4}>
        <div>
          <Text fw={800} fz={17}>
            📆 This week
          </Text>
          <Text size="xs" c="dimmed">
            vs the same point last week
          </Text>
        </div>
        <Button size="compact-sm" variant="light" onClick={() => useUi.setState({ reviewOpen: true })} disabled={before.days < 1}>
          Review last week
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs" mt="sm">
        <Card p="xs" radius="lg">
          <Text fw={900} fz={22} c={`${g.color}.4`}>
            {finished ?? '—'}%
          </Text>
          <Text size="xs" fw={600}>
            Avg score
          </Text>
          <Change now={finished} before={finishedBefore} suffix="%" />
        </Card>
        <Card p="xs" radius="lg">
          <Text fw={900} fz={22}>
            {now.sessions}
          </Text>
          <Text size="xs" fw={600}>
            Sessions
          </Text>
          <Change now={now.sessions} before={before.days ? before.sessions : null} />
        </Card>
        <Card p="xs" radius="lg">
          <Text fw={900} fz={22}>
            {slipsNow}
          </Text>
          <Text size="xs" fw={600}>
            Slips
          </Text>
          <Change now={slipsNow} before={before.days ? slipsBefore : null} invert />
        </Card>
        <Card p="xs" radius="lg">
          <Text fw={900} fz={22} c="yellow.4">
            {now.xp.toLocaleString()}
          </Text>
          <Text size="xs" fw={600}>
            XP
          </Text>
          <Change now={now.xp} before={before.days ? before.xp : null} />
        </Card>
      </SimpleGrid>
    </Card>
  );
}

function AchievementsCard({ summary }: { summary: Summary }) {
  const list = useMemo(() => achievements(summary), [summary]);
  const [showAll, setShowAll] = useState(false);
  const unlocked = list.filter((a) => a.unlocked);
  // Locked ones closest to unlocking first — something to chase.
  const locked = list.filter((a) => !a.unlocked).sort((a, b) => b.progress / b.target - a.progress / a.target);
  const shown = showAll ? [...unlocked, ...locked] : [...unlocked, ...locked].slice(0, 9);
  return (
    <Card p="sm">
      <Group justify="space-between" px={4}>
        <Text fw={800} fz={17}>
          🏅 Badges
        </Text>
        <Badge variant="light" color="yellow" size="lg">
          {unlocked.length}/{list.length}
        </Badge>
      </Group>
      <SimpleGrid cols={3} spacing="xs" mt="sm">
        {shown.map((a) => (
          <Card key={a.id} p="xs" radius="lg" ta="center" className={a.unlocked ? 'hero' : undefined} style={{ opacity: a.unlocked ? 1 : 0.75 }}>
            <Text fz={30} style={{ filter: a.unlocked ? undefined : 'grayscale(1)', opacity: a.unlocked ? 1 : 0.45 }}>
              {a.emoji}
            </Text>
            <Text fz={12} fw={800} lh={1.2} mt={2}>
              {a.title}
            </Text>
            {a.unlocked ? (
              <Text fz={10} c="dimmed" lh={1.2} mt={2}>
                {a.detail}
              </Text>
            ) : (
              <>
                <Progress value={(a.progress / a.target) * 100} size={4} mt={6} color="yellow" radius="xl" />
                <Text fz={10} c="dimmed" mt={2}>
                  {a.progress.toLocaleString()}/{a.target.toLocaleString()}
                </Text>
              </>
            )}
          </Card>
        ))}
      </SimpleGrid>
      {list.length > 9 && (
        <Button variant="subtle" size="xs" fullWidth mt="xs" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </Button>
      )}
    </Card>
  );
}
