import { AreaChart, BarChart, Heatmap } from '@mantine/charts';
import { Button, Card, Group, Progress, SimpleGrid, Stack, Text, Timeline, useComputedColorScheme } from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import BudgetCard from '../components/BudgetCard';
import FinesCard from '../components/FinesCard';
import RecoveryCard from '../components/RecoveryCard';
import { M, Meta, PanelHead, Tap, Tile, WeekDots } from '../components/ui';
import { accent } from '../lib/style';
import { targetOf } from '../lib/actions';
import { achievements } from '../lib/achievements';
import { SECTION_BY_ID, featureOn } from '../lib/config';
import { addDays, fmt, maxKey, relativeDay, weekStart } from '../lib/dates';
import { completionRate, grade, slipStats, totalSaved, weekStats, type Summary } from '../lib/engine';
import { openHabit, openSos, useSummary, useToday, useUi } from '../lib/hooks';
import { insights } from '../lib/insights';
import { averageClock, formatDuration, sleepMinutes } from '../lib/sleep';
import { SCORE_COLORS } from '../lib/scoreColors';
import { useApp } from '../lib/store';
import { habitHistory, personalBests, scoreTrend } from '../lib/trend';

const TABS = [
  ['overview', 'Overview'],
  ['habits', 'Habits'],
  ['trends', 'Trends'],
  ['money', 'Money'],
  ['badges', 'Badges'],
] as const;

function StatTile({ emoji, value, label, sub, color = 'violet' }: { emoji: string; value: string | number; label: string; sub?: string; color?: string }) {
  return (
    <Card p="md" style={accent(color)}>
      <Group gap={8} wrap="nowrap">
        <Tile emoji={emoji} color={color} size={30} />
        <Text size="xs" fw={700} c="dimmed" lh={1.2}>
          {label}
        </Text>
      </Group>
      <Text fw={900} fz={28} lh={1.1} mt={10} className="num" lts={-0.5}>
        {value}
      </Text>
      {sub && (
        <Text size="xs" c="dimmed" fw={600} mt={2}>
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
    <Card p="md">
      <PanelHead emoji="🟩" color="teal" title="Daily score" sub="Stronger colour = more of your list done. Tap a square for the score." />
      <div className="scroll-x" ref={scroller} style={{ marginTop: 12 }}>
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
  if (!stats.length) return null;
  return (
    <Card p="md">
      <PanelHead emoji="🛡️" color="teal" title="Staying clean" sub="How often you slip — the honest numbers" />
      <Stack gap="sm" mt="md">
        {stats.map((s) => {
          const streak = summary.habitStreaks[s.habit.id];
          return (
            <Tap key={s.habit.id} onClick={() => openHabit(s.habit.id)} onLongPress={() => openHabit(s.habit.id)} style={{ background: 'var(--raised)', borderRadius: 16, padding: '12px 14px' }}>
              <Group justify="space-between" wrap="nowrap">
                <Text fw={750}>
                  {s.habit.emoji} {s.habit.label}
                </Text>
                <Text fw={850} c="var(--mantine-color-orange-4)" className="num">
                  <span className="flame">🔥</span> {streak.current}d
                </Text>
              </Group>
              <SimpleGrid cols={4} mt={8} spacing={4}>
                {[
                  [s.slips7, 'slips 7d'],
                  [s.slips30, 'slips 30d'],
                  [`${streak.best}d`, 'best run'],
                  [s.daysSinceSlip ?? '—', 'since slip'],
                ].map(([v, l]) => (
                  <div key={l}>
                    <Text fw={850} className="num">
                      {v}
                    </Text>
                    <Text size="10px" c="dimmed" fw={600}>
                      {l}
                    </Text>
                  </div>
                ))}
              </SimpleGrid>
              {(s.urgesAll > 0 || s.saved != null) && (
                <Group gap="md" mt={6}>
                  {s.urgesAll > 0 && (
                    <Text size="xs" fw={700} c="grape.4">
                      💪 {s.urges7} urges beaten this week ({s.urgesAll} total)
                    </Text>
                  )}
                  {s.saved != null && (
                    <Text size="xs" fw={700} c="var(--good)">
                      💰 £{s.saved} saved{s.savedSinceSlip != null && s.savedSinceSlip !== s.saved ? ` · £${s.savedSinceSlip} since last slip` : ''}
                    </Text>
                  )}
                </Group>
              )}
            </Tap>
          );
        })}
      </Stack>
    </Card>
  );
}

function HabitList({ summary }: { summary: Summary }) {
  const rows = summary.habits
    .filter((h) => h.kind !== 'avoid')
    .map((h) => ({ h, streak: summary.habitStreaks[h.id], rate: completionRate(summary, h.id, 30), week: habitHistory(summary, h.id) }));
  return (
    <Card p="md">
      <PanelHead emoji="🔥" color="orange" title="Habit streaks" sub="Last 7 days (today on the right) · % of the last 30 days · tap one for more" />
      <div style={{ marginTop: 6 }}>
        {rows.map(({ h, streak, rate, week }) => {
          const color = SECTION_BY_ID[h.section].color;
          return (
            <div key={h.id} className="hrow" style={accent(color)}>
              <Tap onClick={() => openHabit(h.id)} aria-label={`${h.label} details`}>
                <div className="hrow-main" style={{ minHeight: 0 }}>
                  <Tile emoji={h.emoji} color={color} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={700} lh={1.25} truncate>
                      {h.label}
                    </Text>
                    <Meta>
                      <M>{rate == null ? 'nothing due yet' : `${rate}% · 30 days`}</M>
                      {streak.best > 1 && <M>best {streak.best}</M>}
                    </Meta>
                  </div>
                  <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                    <WeekDots days={week} color={color} />
                    <Text size="xs" fw={850} c={streak.current >= 2 ? 'var(--mantine-color-orange-4)' : 'dimmed'} lh={1} className="num">
                      {streak.current >= 1 ? (
                        <>
                          <span className="flame">🔥</span> {streak.current}
                        </>
                      ) : (
                        'no streak'
                      )}
                    </Text>
                  </Stack>
                </div>
              </Tap>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TrainingChart({ summary }: { summary: Summary }) {
  const target = useApp((s) => s.settings.workoutTarget);
  const data = summary.weeks.slice(-12).map((w) => ({ week: fmt(w.start, 'D MMM'), sessions: w.sessions }));
  const hitWeeks = summary.weeks.filter((w) => w.outcome === 'success').length;
  return (
    <Card p="md">
      <PanelHead emoji="🏋️" color="lime" title="Gym sessions per week" sub={`Hit ${target}+ in ${hitWeeks} week${hitWeeks === 1 ? '' : 's'} · current run ${summary.trainingStreak.current} · best ${summary.trainingStreak.best}`} />
      <BarChart
        mt="md"
        h={180}
        data={data}
        dataKey="week"
        series={[{ name: 'sessions', label: 'Sessions', color: 'lime.5' }]}
        referenceLines={[{ y: target, label: `Target ${target}`, color: 'gray.6' }]}
        yAxisProps={{ allowDecimals: false, domain: [0, Math.max(target + 1, ...data.map((d) => d.sessions))], width: 24 }}
        gridAxis="x"
        tickLine="none"
        barProps={{ radius: [6, 6, 0, 0] }}
        maxBarWidth={26}
      />
    </Card>
  );
}

/** Are you getting better? A 7-day average of your daily score, this month vs last, and your bests. */
function TrendCard({ summary }: { summary: Summary }) {
  const trend = useMemo(() => scoreTrend(summary, 56), [summary]);
  const bests = useMemo(() => personalBests(summary), [summary]);
  const data = trend.points.map((p) => ({ ...p, label: fmt(p.date, 'D MMM') }));
  const diff = trend.recent != null && trend.previous != null ? trend.recent - trend.previous : null;
  const line =
    trend.scored < 5
      ? 'Log a week or so and your trend shows up here.'
      : trend.recent == null
        ? 'A 7-day average of your daily score.'
        : `Last 4 weeks: ${trend.recent}% on average${diff == null ? '' : diff > 0 ? ` · up ${diff}% on the 4 weeks before` : diff < 0 ? ` · down ${-diff}% on the 4 weeks before` : ' · level with the 4 weeks before'}`;
  return (
    <Card p="md">
      <PanelHead emoji="📈" color="teal" title="Better than last month?" sub={<span style={{ color: diff != null && diff > 0 ? 'var(--good)' : diff != null && diff < 0 ? 'var(--warn)' : undefined, fontWeight: diff ? 750 : undefined }}>{line}</span>} />
      {trend.scored >= 5 && (
        <AreaChart
          mt="md"
          h={170}
          data={data}
          dataKey="label"
          series={[{ name: 'avg', label: '7-day average', color: 'teal.5' }]}
          curveType="monotone"
          strokeWidth={2.5}
          fillOpacity={0.14}
          withDots={false}
          connectNulls
          gridAxis="x"
          tickLine="none"
          strokeDasharray="0"
          yAxisProps={{ domain: [0, 100], ticks: [0, 50, 100], width: 42, tickFormatter: (v: number) => `${v}%` }}
          xAxisProps={{ interval: 'preserveStartEnd', minTickGap: 48 }}
          referenceLines={trend.previous != null ? [{ y: trend.previous, label: `last month ${trend.previous}%`, labelPosition: 'insideBottomLeft', color: 'gray.6' }] : []}
          valueFormatter={(v) => `${v}%`}
        />
      )}
      {(bests.bestDay || bests.bestWeek || bests.longestLog > 0) && (
        <SimpleGrid cols={3} mt="md" spacing="xs">
          {[
            [bests.bestDay ? `${bests.bestDay.pct}%` : '—', `best day${bests.bestDay ? ` · ${fmt(bests.bestDay.date, 'D MMM')}` : ''}`],
            [bests.bestWeek ? `${bests.bestWeek.avg}%` : '—', `best week${bests.bestWeek ? ` · w/c ${fmt(bests.bestWeek.start, 'D MMM')}` : ' · needs a full week'}`],
            [bests.longestLog, 'longest logging streak'],
          ].map(([v, l]) => (
            <div key={l as string} style={{ background: 'var(--raised)', borderRadius: 14, padding: '10px 12px' }}>
              <Text fw={900} fz={18} className="num">
                {v}
              </Text>
              <Text size="10px" c="dimmed" fw={600} lh={1.25}>
                {l}
              </Text>
            </div>
          ))}
        </SimpleGrid>
      )}
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
  const water = summary.habits.find((h) => h.kind === 'water');
  const fin = summary.habits.some((h) => h.kind === 'dose');
  // Apple Watch nights (only if the Shortcut is set up)
  const watched = last30.map((e) => e.log?.sleepAuto).filter((s): s is NonNullable<typeof s> => !!s);
  const avgSleep = watched.length ? watched.reduce((sum, s) => sum + sleepMinutes(s.asleep, s.awake), 0) / watched.length : null;
  return (
    <SimpleGrid cols={2} spacing="sm">
      {avgSleep != null && (
        <>
          <StatTile emoji="⌚" color="indigo" value={formatDuration(avgSleep)} label="Average sleep" sub={`${watched.length} night${watched.length === 1 ? '' : 's'} from your Watch`} />
          <StatTile emoji="🛏️" color="indigo" value={averageClock(watched.map((s) => s.asleep)) ?? '—'} label="Average bedtime" sub={`up around ${averageClock(watched.map((s) => s.awake))}`} />
        </>
      )}
      <StatTile emoji="🌙" color="indigo" value={lateNights.length} label="Late nights" sub="past your target · 30 days" />
      <StatTile emoji="⏰" color="orange" value={lateWakes.length} label="Late mornings" sub="past your target · 30 days" />
      {fin && <StatTile emoji="💧" color="cyan" value={`${finDays.length}/${last30.length}`} label="Finasteride days" sub={`avg ${avgMl.toFixed(2)} ml · ${(avgMl * mgPerMl).toFixed(3)} mg`} />}
      {water && <StatTile emoji="🚰" color="cyan" value={last30.filter((e) => (e.log?.water ?? 0) >= targetOf(water)).length} label="Water target days" sub="last 30 days" />}
    </SimpleGrid>
  );
}

function NotesCard({ summary }: { summary: Summary }) {
  const today = useToday();
  const notes = summary.evals.filter((e) => e.log?.note?.trim()).slice(-15).reverse();
  if (!notes.length) return null;
  return (
    <Card p="md">
      <PanelHead emoji="📝" color="violet" title="Notes to self" sub="What you told tomorrow-you" />
      <Timeline bulletSize={12} lineWidth={2} active={notes.length} mt="md" color="violet">
        {notes.map((e) => (
          <Timeline.Item
            key={e.date}
            title={
              <Text size="xs" c="dimmed" fw={700}>
                {relativeDay(e.date, today)}
              </Text>
            }
          >
            <Text size="sm" fw={550}>
              {e.log?.note}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
}

function SavingsCard({ summary }: { summary: Summary }) {
  const stats = slipStats(summary).filter((s) => s.habit.kind === 'avoid');
  const total = totalSaved(summary);
  return (
    <Card p="md">
      <PanelHead
        emoji="💰"
        color="teal"
        title="Money kept"
        sub="Clean days × what each habit used to cost you"
        right={
          total != null && (
            <Text fw={900} fz={22} c="var(--good)" className="num">
              £{total}
            </Text>
          )
        }
      />
      <div style={{ marginTop: 6 }}>
        {stats.map((s) => (
          <div key={s.habit.id} className="hrow">
            <Tap onClick={() => openHabit(s.habit.id)} aria-label={`${s.habit.label}: set its cost`}>
              <div className="hrow-main" style={{ minHeight: 0 }}>
                <Tile emoji={s.habit.emoji} color="teal" size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={700}>
                    {s.habit.label.replace(/^No /, '').replace(/^\w/, (c) => c.toUpperCase())}
                  </Text>
                  <Meta>{s.saved == null ? <M>tap to set what it cost you a week</M> : <M>{s.cleanDays} clean days</M>}</Meta>
                </div>
                <Text fw={850} c={s.saved ? 'var(--good)' : 'dimmed'} className="num">
                  {s.saved == null ? '—' : `£${s.saved}`}
                </Text>
              </div>
            </Tap>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function ProgressPage() {
  const summary = useSummary();
  const { level, totalXp, logStreak, evals, settings } = summary;
  const today = useToday();
  const perfectDays = evals.filter((e) => e.perfect).length;
  const scored = evals.filter((e) => e.pct != null && e.closed);
  const avg = scored.length ? Math.round(scored.reduce((s, e) => s + (e.pct ?? 0), 0) / scored.length) : 0;
  const vape = summary.habits.some((h) => h.id === 'vape') ? (summary.habitStreaks.vape ?? { current: 0, best: 0 }) : null;
  const tab = useUi((s) => s.progressTab);
  const setTab = (t: string) => useUi.setState({ progressTab: t });

  return (
    <Stack gap={14}>
      <div>
        <div className="eyebrow">Since {fmt(settings.startDate, 'D MMM YYYY')}</div>
        <Text component="h1" className="page-title" mt={4}>
          Progress
        </Text>
      </div>

      <Card p="md" className="hero">
        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <div>
            <div className="eyebrow">Level {level.level}</div>
            <Text fw={900} fz={26} lh={1.15} lts={-0.4}>
              {level.title}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text fw={900} fz={26} c="var(--xp)" className="num" lh={1.15}>
              {totalXp.toLocaleString()}
            </Text>
            <Text size="xs" c="dimmed" fw={650}>
              total XP
            </Text>
          </div>
        </Group>
        <Progress mt="sm" value={(level.into / level.need) * 100} size="lg" radius="xl" color="yellow" striped animated />
        <Text size="xs" c="dimmed" fw={650} mt={6}>
          {(level.need - level.into).toLocaleString()} XP to level {level.level + 1}
        </Text>
      </Card>

      <div className="chip-row bleed" role="tablist">
        {TABS.map(([value, label]) => (
          <Tap key={value} className="chip" data-active={tab === value || undefined} onClick={() => setTab(value)} role="tab" aria-selected={tab === value} style={{ height: 36, padding: '0 16px', fontSize: 14 }}>
            {label}
          </Tap>
        ))}
      </div>

      {tab === 'overview' && (
        <Stack gap={14}>
          <SimpleGrid cols={2} spacing="sm">
            <StatTile emoji="🔥" color="orange" value={logStreak.current} label="Days logged in a row" sub={`best ${logStreak.best}`} />
            {vape ? (
              <StatTile emoji="🚭" color="teal" value={vape.current} label="Days nicotine-free" sub={`best ${vape.best}`} />
            ) : (
              <StatTile emoji="🏆" color="yellow" value={perfectDays} label="Perfect days" />
            )}
            <StatTile emoji="📊" color="violet" value={`${avg}%`} label="Average score" sub={`${scored.length} days locked in`} />
            <StatTile emoji="💪" color="lime" value={summary.trainingStreak.current} label="Weeks hitting gym target" sub={`best ${summary.trainingStreak.best}`} />
            {vape && <StatTile emoji="🏆" color="yellow" value={perfectDays} label="Perfect days" />}
            <StatTile emoji="💷" color={summary.owed ? 'red' : 'teal'} value={`£${summary.fineTotal}`} label="Total fines" sub={summary.owed ? `£${summary.owed} still owed` : 'all paid up'} />
          </SimpleGrid>
          <InsightsCard summary={summary} />
          <WeekCard summary={summary} />
        </Stack>
      )}
      {tab === 'habits' && (
        <Stack gap={14}>
          <RecoveryCard summary={summary} />
          <CleanCard summary={summary} />
          {featureOn(settings, 'sos') && summary.habits.some((h) => h.kind === 'avoid') && (
            <Button variant="light" color="red" onClick={() => openSos()}>
              🆘 Craving? Ride it out for 10 minutes
            </Button>
          )}
          <HabitList summary={summary} />
          {settings.workoutTarget > 0 && <TrainingChart summary={summary} />}
        </Stack>
      )}
      {tab === 'trends' && (
        <Stack gap={14}>
          <TrendCard summary={summary} />
          <ScoreHeatmap summary={summary} />
          <BodyCard summary={summary} />
          <NotesCard summary={summary} />
        </Stack>
      )}
      {tab === 'money' && (
        <Stack gap={14}>
          {featureOn(settings, 'budget') ? (
            <BudgetCard today={today} />
          ) : (
            <Card p="md">
              <Text size="sm" c="dimmed">
                💳 Card spending is switched off (Settings → Today page).
              </Text>
            </Card>
          )}
          <SavingsCard summary={summary} />
          <FinesCard />
        </Stack>
      )}
      {tab === 'badges' && <AchievementsCard summary={summary} />}
    </Stack>
  );
}

function InsightsCard({ summary }: { summary: Summary }) {
  const list = useMemo(() => insights(summary), [summary]);
  return (
    <Card p="md">
      <PanelHead emoji="🧠" color="grape" title="What your data says" sub="Patterns from your own days" />
      {list.length === 0 ? (
        <Text size="sm" c="dimmed" mt="sm">
          Log a couple of weeks and patterns show up here — like how your sleep affects the rest of your day, and when you tend to slip.
        </Text>
      ) : (
        <div style={{ marginTop: 6 }}>
          {list.slice(0, 6).map((i) => (
            <div key={i.id} className="hrow">
              <div className="hrow-main">
                <Tile emoji={i.emoji} color={i.tone === 'good' ? 'teal' : i.tone === 'bad' ? 'orange' : 'violet'} size={34} />
                <Text size="sm" fw={600} lh={1.4} style={{ flex: 1 }}>
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
  if (now == null || before == null)
    return (
      <Text size="xs" c="dimmed" fw={600}>
        no data last week
      </Text>
    );
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0)
    return (
      <Text size="xs" c="dimmed" fw={600}>
        same as last week
      </Text>
    );
  const good = invert ? diff < 0 : diff > 0;
  return (
    <Text size="xs" fw={850} c={good ? 'var(--good)' : 'var(--bad)'}>
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
    <Card p="md">
      <PanelHead
        emoji="📆"
        color="blue"
        title="This week"
        sub="vs the same point last week"
        right={
          <Button size="compact-sm" variant="light" onClick={() => useUi.setState({ reviewOpen: true })} disabled={before.days < 1}>
            Last week's review
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs" mt="md">
        {[
          { v: `${finished ?? '—'}%`, l: 'Avg score', c: `var(--mantine-color-${g.color}-4)`, d: <Change now={finished} before={finishedBefore} suffix="%" /> },
          { v: now.sessions, l: 'Gym sessions', d: <Change now={now.sessions} before={before.days ? before.sessions : null} /> },
          { v: slipsNow, l: 'Slips', d: <Change now={slipsNow} before={before.days ? slipsBefore : null} invert /> },
          { v: now.xp.toLocaleString(), l: 'XP', c: 'var(--xp)', d: <Change now={now.xp} before={before.days ? before.xp : null} /> },
        ].map((x) => (
          <div key={x.l} style={{ background: 'var(--raised)', borderRadius: 14, padding: '10px 12px' }}>
            <Text fw={900} fz={22} c={x.c} className="num">
              {x.v}
            </Text>
            <Text size="xs" fw={700}>
              {x.l}
            </Text>
            {x.d}
          </div>
        ))}
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
  const shown = showAll ? [...unlocked, ...locked] : [...unlocked, ...locked].slice(0, 12);
  return (
    <Card p="md">
      <PanelHead
        emoji="🏅"
        color="yellow"
        title="Badges"
        sub={`${unlocked.length} of ${list.length} unlocked`}
        right={
          <Text fw={900} c="var(--xp)" className="num">
            {Math.round((unlocked.length / Math.max(1, list.length)) * 100)}%
          </Text>
        }
      />
      <SimpleGrid cols={3} spacing="xs" mt="md">
        {shown.map((a) => (
          <div
            key={a.id}
            style={{
              textAlign: 'center',
              padding: '12px 6px 10px',
              borderRadius: 16,
              background: a.unlocked ? 'var(--brand-soft)' : 'var(--raised)',
              border: a.unlocked ? '1px solid rgba(151, 117, 250, 0.3)' : '1px solid transparent',
            }}
          >
            <Text fz={30} style={{ filter: a.unlocked ? undefined : 'grayscale(1)', opacity: a.unlocked ? 1 : 0.45 }}>
              {a.emoji}
            </Text>
            <Text fz={12} fw={800} lh={1.2} mt={2}>
              {a.title}
            </Text>
            {a.unlocked ? (
              <Text fz={10} c="dimmed" lh={1.25} mt={3} fw={600}>
                {a.detail}
              </Text>
            ) : (
              <>
                <Progress value={(a.progress / a.target) * 100} size={4} mt={7} color="yellow" radius="xl" />
                <Text fz={10} c="dimmed" mt={3} fw={650} className="num">
                  {a.progress.toLocaleString()}/{a.target.toLocaleString()}
                </Text>
              </>
            )}
          </div>
        ))}
      </SimpleGrid>
      {list.length > 12 && (
        <Button variant="subtle" size="xs" fullWidth mt="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </Button>
      )}
    </Card>
  );
}
