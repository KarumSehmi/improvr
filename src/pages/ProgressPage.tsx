import { BarChart, Heatmap, LineChart } from '@mantine/charts';
import {
  Badge,
  Card,
  Group,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Timeline,
  Title,
  useComputedColorScheme,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { AVOIDS, HABITS } from '../lib/config';
import { addDays, fmt, maxKey, relativeDay } from '../lib/dates';
import { completionRate, slipStats, type Summary } from '../lib/engine';
import { useSummary, useToday } from '../lib/hooks';
import { SCORE_COLORS } from '../lib/scoreColors';
import { useApp } from '../lib/store';

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
            </Card>
          );
        })}
      </Stack>
    </Card>
  );
}

function StreakTable({ summary }: { summary: Summary }) {
  const rows = HABITS.filter((h) => h.kind !== 'avoid').map((h) => ({
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

function WeightCard() {
  const days = useApp((s) => s.days);
  const unit = useApp((s) => s.settings.weightUnit);
  const [range, setRange] = useState('90');
  const today = useToday();
  const from = range === 'all' ? '0000' : addDays(today, -Number(range));
  const points = Object.entries(days)
    .filter(([d, l]) => l.weight && d >= from)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, l]) => ({ date: fmt(d, 'D MMM'), weight: l.weight as number }));
  const first = points[0]?.weight;
  const last = points.at(-1)?.weight;
  const change = first != null && last != null ? last - first : null;

  return (
    <Card p="sm">
      <Group justify="space-between" px={4}>
        <div>
          <Text fw={800}>⚖️ Weight</Text>
          <Text size="xs" c="dimmed">
            {last != null ? `${last} ${unit}` : 'No weigh-ins yet'}
            {change != null && points.length > 1 && ` · ${change > 0 ? '+' : ''}${change.toFixed(1)} ${unit} in range`}
          </Text>
        </div>
        <SegmentedControl size="xs" value={range} onChange={setRange} data={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: 'all', label: 'All' }]} />
      </Group>
      {points.length > 1 ? (
        <LineChart
          mt="md"
          h={200}
          data={points}
          dataKey="date"
          series={[{ name: 'weight', label: `Weight (${unit})`, color: 'violet.5' }]}
          curveType="monotone"
          strokeWidth={2}
          withDots={points.length < 40}
          yAxisProps={{ domain: ['dataMin - 1', 'dataMax + 1'], width: 36, tickFormatter: (v: number) => String(Math.round(v)) }}
          gridAxis="x"
          tickLine="none"
          valueFormatter={(v) => `${v} ${unit}`}
        />
      ) : (
        <Text size="sm" c="dimmed" px={4} mt="sm">
          Weigh in a couple of mornings and your trend shows up here.
        </Text>
      )}
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
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
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
  const vape = summary.habitStreaks[AVOIDS[0].id];

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

      <ScoreHeatmap summary={summary} />
      <CleanCard summary={summary} />
      <StreakTable summary={summary} />
      <WeightCard />
      <TrainingChart summary={summary} />
      <BodyCard summary={summary} />
      <NotesCard summary={summary} />
    </Stack>
  );
}
