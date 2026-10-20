/**
 * A habit's full stats: how it's going over the last 30 or 90 days or all time, a calendar you can tap into,
 * week by week, which days of the week, its runs — plus slips and cravings for stay-clean habits, and the
 * times themselves for sleep and wake. Opened by tapping a habit on Progress, or "Full stats" in its sheet.
 */
import { BarChart, LineChart } from '@mantine/charts';
import { ActionIcon, Button, Group, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconSettings } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState, type ReactNode } from 'react';
import { Rectangle, type DotItemDotProps, type RectangleProps } from 'recharts';
import { targetOf } from '../lib/actions';
import { SECTION_BY_ID, WEEKDAYS, clockLabel, weekdayTargets, weekendTargets, type Habit } from '../lib/config';
import { fmt, maxKey, relativeDay, type DateKey } from '../lib/dates';
import { slipStats, type Summary } from '../lib/engine';
import {
  RANGES,
  amounts,
  byWeekday,
  cleanStats,
  cravingTimes,
  dayState,
  lastDay,
  monthDays,
  patterns,
  periods,
  rangeStart,
  rangeTally,
  runs,
  slipLog,
  timeStats,
  usualTick,
  type DayState,
  type Pattern,
  type StatsRange,
} from '../lib/habitStats';
import { openDay, openHabit, useSummary, useUi } from '../lib/hooks';
import { recovery } from '../lib/recovery';
import { formatDuration, loggedTime, minutesToClock, nightOf, offBy, shortClock, targetFor, timeScale } from '../lib/sleep';
import { accent } from '../lib/style';
import { Bar, M, Meta, Tap, Tile } from './ui';

export default function HabitStats({ id }: { id: string }) {
  const summary = useSummary();
  const [range, setRange] = useState<StatsRange>('30');
  const habit = summary.habits.find((h) => h.id === id);
  if (!habit) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        This habit is switched off. Switch it back on in Settings → Habits to see its stats.
      </Text>
    );
  }
  const color = SECTION_BY_ID[habit.section].color;
  const from = rangeStart(summary, range);
  const days = rangeTally(summary, id, from).days;

  // Sleep and wake read "on target" in teal everywhere (as on Today); everything else wears its part of the day.
  return (
    <Stack gap="md" style={accent(habit.kind === 'time' ? 'teal' : color)}>
      <Header habit={habit} summary={summary} color={color} />
      <div>
        <SegmentedControl fullWidth value={range} onChange={(v) => setRange(v as StatsRange)} data={RANGES} aria-label="How far back" />
        <Text size="xs" c="dimmed" fw={600} ta="center" mt={6}>
          {fmt(from, 'D MMM')} – {fmt(summary.today, 'D MMM')} · {days} day{days === 1 ? '' : 's'}
        </Text>
      </div>
      {habit.kind === 'avoid' ? <CleanTiles summary={summary} habit={habit} from={from} /> : habit.kind === 'time' ? <TimeTiles summary={summary} habit={habit} from={from} /> : <HabitTiles summary={summary} habit={habit} from={from} />}
      {habit.id === 'vape' && <Recovery summary={summary} />}
      {habit.kind === 'time' ? <TimeCharts summary={summary} habit={habit} from={from} /> : <WeekChart summary={summary} habit={habit} from={from} color={color} />}
      <Calendar summary={summary} habit={habit} />
      <Patterns list={patterns(summary, id, from)} />
      <Weekdays summary={summary} habit={habit} from={from} />
      {habit.kind === 'avoid' && (
        <>
          <Cravings summary={summary} habit={habit} from={from} />
          <Slips summary={summary} habit={habit} from={from} />
        </>
      )}
      <Runs summary={summary} habit={habit} />
      {habit.kind === 'avoid' && <Money summary={summary} habit={habit} />}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Panel({ title, sub, right, children }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="stats-panel">
      <Group justify="space-between" wrap="nowrap" gap="xs" mb={10} align="flex-start">
        <div style={{ minWidth: 0 }}>
          <div className="stats-title">{title}</div>
          {sub && <div className="panel-sub">{sub}</div>}
        </div>
        {right}
      </Group>
      {children}
    </section>
  );
}

interface TileItem {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  tone?: 'good' | 'bad' | 'streak';
}

function Tiles({ items }: { items: TileItem[] }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
      {items.map((t) => (
        <div key={t.label} className="stats-tile">
          <div className="stats-tile-value" data-tone={t.tone}>
            {t.value}
          </div>
          <div className="stats-tile-label">{t.label}</div>
          {t.sub && <div className="stats-tile-sub">{t.sub}</div>}
        </div>
      ))}
    </SimpleGrid>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const flame = (n: number) => (
  <>
    <span className="flame">🔥</span> {n}
  </>
);
/** "drinking nights" for the one with an allowance (it's the honest word), "slips" for the rest. */
const slipNoun = (h: Habit) => (h.id === 'alcohol' ? 'drinking nights' : 'slips');

function Header({ habit, summary, color }: { habit: Habit; summary: Summary; color: string }) {
  const sec = SECTION_BY_ID[habit.section];
  const since = maxKey(summary.settings.startDate, habit.since ?? summary.settings.startDate);
  return (
    <Group gap="md" wrap="nowrap" mt={4}>
      <Tile emoji={habit.emoji} color={color} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow">📊 Stats</div>
        <Text fw={850} fz={20} lh={1.2} lts={-0.3}>
          {habit.label}
        </Text>
        <Text size="xs" c="dimmed" fw={600} mt={2}>
          {sec.emoji} {sec.title} · since {fmt(since, 'D MMM YYYY')}
        </Text>
      </div>
      <ActionIcon variant="light" color="gray" size="lg" onClick={() => openHabit(habit.id)} aria-label={`${habit.label}: settings`}>
        <IconSettings size={18} />
      </ActionIcon>
    </Group>
  );
}

// ---------------------------------------------------------------------------
// The headline numbers
// ---------------------------------------------------------------------------

function CleanTiles({ summary, habit, from }: { summary: Summary; habit: Habit; from: DateKey }) {
  const c = cleanStats(summary, habit.id, from);
  const streak = summary.habitStreaks[habit.id];
  const all = slipStats(summary).find((s) => s.habit.id === habit.id);
  const answered = c.clean + c.slips;
  return (
    <Tiles
      items={[
        { value: flame(streak.current), label: 'days in a row', sub: `best ${streak.best}`, tone: 'streak' },
        { value: c.clean, label: 'clean days', sub: answered ? `${Math.round((c.clean / answered) * 100)}% of days answered` : 'none answered yet', tone: 'good' },
        {
          value: c.slips,
          label: slipNoun(habit),
          sub: c.allowed ? `${c.allowed} inside your allowance` : all?.lastSlip ? `last: ${relativeDay(all.lastSlip, summary.today)}` : 'none yet 🙌',
          tone: c.slips > c.allowed ? 'bad' : undefined,
        },
        { value: c.urges, label: 'cravings beaten', sub: `${all?.urges7 ?? 0} in the last 7 days` },
      ]}
    />
  );
}

function TimeTiles({ summary, habit, from }: { summary: Summary; habit: Habit; from: DateKey }) {
  const t = timeStats(summary, habit.id, from);
  const streak = summary.habitStreaks[habit.id];
  return (
    <Tiles
      items={[
        { value: t.usual ? clockLabel(t.usual) : '—', label: habit.id === 'sleep' ? 'usual bedtime' : 'usual wake-up', sub: t.spread != null ? `give or take ${formatDuration(t.spread)}` : 'log a few to see it' },
        { value: t.answered ? `${t.onTarget}/${t.answered}` : '—', label: 'on target', sub: t.answered ? `${Math.round((t.onTarget / t.answered) * 100)}% of ${habit.id === 'sleep' ? 'nights' : 'mornings'}` : undefined, tone: 'good' },
        { value: t.avgSleep != null ? formatDuration(t.avgSleep) : '—', label: 'average sleep', sub: t.nights ? plural(t.nights, 'night') : 'log both times to see it' },
        { value: flame(streak.current), label: 'in a row', sub: `best ${streak.best}`, tone: 'streak' },
      ]}
    />
  );
}

function HabitTiles({ summary, habit, from }: { summary: Summary; habit: Habit; from: DateKey }) {
  const t = rangeTally(summary, habit.id, from);
  const missed = lastDay(summary, habit.id, from, 'missed');
  const streak = summary.habitStreaks[habit.id];
  let third: TileItem;
  if (habit.kind === 'water' || habit.kind === 'count') {
    const a = amounts(summary, habit, from);
    const unit = habit.kind === 'water' ? 'bottles' : (habit.unit ?? '');
    third = { value: a.avg ?? '—', label: 'a day on average', sub: `target ${targetOf(habit)}${unit ? ` ${unit}` : ''}` };
  } else if (habit.kind === 'chore') {
    third = { value: t.done, label: 'times done', sub: 'in this stretch' };
  } else {
    const tick = usualTick(summary, habit.id, from);
    third = { value: tick ? clockLabel(tick) : '—', label: 'usually ticked off', sub: tick ? 'the middle of your tick times' : 'needs a few more ticks' };
  }
  return (
    <Tiles
      items={[
        { value: flame(streak.current), label: 'in a row', sub: `best ${streak.best}`, tone: 'streak' },
        { value: t.rate != null ? `${t.rate}%` : '—', label: 'done', sub: `${t.done + t.allowed} of ${plural(t.judged, 'day')}`, tone: 'good' },
        third,
        { value: t.missed, label: 'missed', sub: missed ? `last: ${relativeDay(missed, summary.today)}` : 'not once 🙌', tone: t.missed ? 'bad' : undefined },
      ]}
    />
  );
}

/** Nicotine: where you are on the timeline of what stopping does. */
function Recovery({ summary }: { summary: Summary }) {
  const days = summary.habitStreaks.vape?.current ?? 0;
  const r = recovery(days);
  if (!r.next) {
    return (
      <Panel title="🏆 A year nicotine-free" sub="That's who you are now.">
        <Bar value={100} color="teal" />
      </Panel>
    );
  }
  const base = r.latest?.days ?? 0;
  return (
    <Panel title={`Next: ${r.next.emoji} ${r.next.title} nicotine-free`} sub={r.next.text} right={<Text size="xs" fw={800} c="dimmed" style={{ flexShrink: 0 }}>in {plural(r.inDays, 'day')}</Text>}>
      <Bar value={((days - base) / (r.next.days - base)) * 100} color="teal" />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

/** Every chart here: solid hairline gridlines across (Mantine's "x" grid is the horizontal one), no tick marks. */
const CHART = { gridAxis: 'x', strokeDasharray: '0', tickLine: 'none' } as const;

/** Week by week (or month by month): clean days and slips, or the % done. */
function WeekChart({ summary, habit, from, color }: { summary: Summary; habit: Habit; from: DateKey; color: string }) {
  const ps = periods(summary, habit.id, from);
  const monthly = ps.length > 0 && !/\d/.test(ps[0].label);
  const title = monthly ? 'Month by month' : 'Week by week';
  if (!ps.some((p) => p.judged)) {
    return (
      <Panel title={title}>
        <Text size="sm" c="dimmed">
          Nothing to show yet — it fills in as the days go by.
        </Text>
      </Panel>
    );
  }
  if (habit.kind === 'avoid') {
    const data = ps.map((p) => ({ label: p.label, clean: p.done, slips: p.missed + p.allowed }));
    return (
      <Panel title={title} sub={`Clean days and ${slipNoun(habit)}`}>
        <BarChart
          h={200}
          data={data}
          dataKey="label"
          type="stacked"
          series={[
            { name: 'clean', label: 'Clean', color: 'teal.5' },
            { name: 'slips', label: habit.id === 'alcohol' ? 'Drank' : 'Slipped', color: 'red.6' },
          ]}
          withLegend
          legendProps={{ verticalAlign: 'bottom', height: 30 }}
          maxBarWidth={24}
          yAxisProps={{ allowDecimals: false, width: 26 }}
          // A 2px gap between the two parts, and only the top one rounded.
          barProps={(s) => ({
            stroke: 'var(--raised)',
            strokeWidth: 2,
            strokeOpacity: 1,
            shape: (p: RectangleProps & { payload?: { slips: number } }) => <Rectangle {...p} radius={s.name === 'slips' || !p.payload?.slips ? [4, 4, 0, 0] : 0} />,
          })}
          {...CHART}
        />
      </Panel>
    );
  }
  const data = ps.map((p) => ({ label: p.label, done: p.rate ?? 0 }));
  return (
    <Panel title={title} sub="% of the days it was due that you did it">
      <BarChart
        h={180}
        data={data}
        dataKey="label"
        series={[{ name: 'done', label: 'Done', color: `${color}.5` }]}
        maxBarWidth={24}
        barProps={{ radius: [4, 4, 0, 0] }}
        yAxisProps={{ domain: [0, 100], ticks: [0, 50, 100], width: 40, tickFormatter: (v: number) => `${v}%` }}
        valueFormatter={(v) => `${v}%`}
        {...CHART}
      />
    </Panel>
  );
}

/** A night's dot: teal on target, red when late, ringed so it stands off the line. */
function TimeDot({ index, cx, cy, payload }: DotItemDotProps) {
  const ok = (payload as { ok?: boolean | null } | undefined)?.ok;
  if (cx == null || cy == null || ok == null) return <g key={index} />;
  return <circle key={index} cx={cx} cy={cy} r={4.5} fill={ok ? 'var(--mantine-color-teal-5)' : 'var(--mantine-color-red-5)'} stroke="var(--raised)" strokeWidth={2} />;
}

/** Sleep and wake: the time night by night against the target (earlier is up), and hours asleep. */
function TimeCharts({ summary, habit, from }: { summary: Summary; habit: Habit; from: DateKey }) {
  const t = timeStats(summary, habit.id, from);
  const id = habit.id;
  const night = id === 'sleep';
  const [wk, we] = night ? [weekdayTargets(summary.settings).sleep, weekendTargets(summary.settings).sleep] : [weekdayTargets(summary.settings).wake, weekendTargets(summary.settings).wake];
  const title = night ? 'Asleep, night by night' : 'Up, morning by morning';
  const vals = t.points.filter((p) => p.scale != null).map((p) => p.scale!);
  if (!vals.length) {
    return (
      <Panel title={title}>
        <Text size="sm" c="dimmed">
          Tap the time you {night ? 'fell asleep' : 'got up'} on Today and it shows up here — or let your Apple Watch fill it in.
        </Text>
      </Panel>
    );
  }
  // Room for every time and both target lines, to the hour.
  const edges = [...vals, timeScale(id, wk), timeScale(id, we)];
  const lo = Math.floor((Math.min(...edges) - 30) / 60) * 60;
  const hi = Math.ceil((Math.max(...edges) + 30) / 60) * 60;
  const step = hi - lo > 360 ? 120 : 60;
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const data = t.points.map((p) => ({ label: fmt(p.date, 'D MMM'), time: p.scale, ok: p.ok }));
  const dense = data.length > 45;
  const hours = t.points.filter((p) => p.mins != null).map((p) => ({ label: fmt(p.date, 'D MMM'), hours: Math.round(p.mins! / 6) / 10 }));
  // The targets are explained above the chart rather than labelled on it, where they'd sit on the dots.
  const targets = we === wk ? `the dashed line is your ${clockLabel(wk)} target` : `dashed lines: ${clockLabel(wk)} on weekdays, ${clockLabel(we)} at the weekend`;
  return (
    <>
      <Panel title={title} sub={`Higher is earlier · ${targets}`}>
        <LineChart
          h={210}
          data={data}
          dataKey="label"
          series={[{ name: 'time', label: night ? 'Asleep' : 'Up', color: 'gray.5' }]}
          curveType="linear"
          strokeWidth={2}
          connectNulls={false}
          lineProps={{ dot: dense ? false : TimeDot, activeDot: { r: 6, strokeWidth: 2, stroke: 'var(--raised)' } }}
          yAxisProps={{ reversed: true, domain: [lo, hi], ticks, interval: 0, width: 46, allowDataOverflow: true, tickFormatter: (v: number) => shortClock(minutesToClock(v)) }}
          xAxisProps={{ interval: 'preserveStartEnd', minTickGap: 40 }}
          referenceLines={[
            { y: timeScale(id, wk), color: 'teal.6', strokeDasharray: '4 4' },
            ...(we === wk ? [] : [{ y: timeScale(id, we), color: 'gray.6', strokeDasharray: '4 4' }]),
          ]}
          valueFormatter={(v) => clockLabel(minutesToClock(v))}
          {...CHART}
        />
      </Panel>
      {hours.length > 0 && (
        <Panel title="Hours asleep" sub={t.avgSleep != null ? `${formatDuration(t.avgSleep)} a night on average (the line), from ${plural(t.nights, 'night')} with both times` : undefined}>
          <BarChart
            h={170}
            data={hours}
            dataKey="label"
            series={[{ name: 'hours', label: 'Asleep', color: 'indigo.5' }]}
            maxBarWidth={18}
            barProps={{ radius: [4, 4, 0, 0] }}
            referenceLines={t.avgSleep != null ? [{ y: Math.round(t.avgSleep / 6) / 10, color: 'var(--text-2)' }] : []}
            yAxisProps={{ domain: [0, (max: number) => Math.max(9, Math.ceil(max))], allowDecimals: false, width: 32, tickFormatter: (v: number) => `${v}h` }}
            valueFormatter={(v) => formatDuration(v * 60)}
            {...CHART}
          />
        </Panel>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The calendar: every day, and tap one for what happened
// ---------------------------------------------------------------------------

const monthOf = (d: DateKey) => `${d.slice(0, 7)}-01`;
const HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** What each kind of day is called for this habit. */
function stateWords(h: Habit): Record<DayState, string> {
  if (h.kind === 'avoid') return { done: 'Clean', missed: h.id === 'alcohol' ? 'Drank' : 'Slipped', allowed: 'Inside your allowance', blank: 'Not answered', open: 'Still open', off: 'Day off', none: 'Not tracked' };
  if (h.kind === 'time') return { done: 'On target', missed: 'Late', allowed: 'Allowed', blank: 'Not answered', open: 'Still open', off: 'Day off', none: 'Not tracked' };
  return { done: 'Done', missed: h.kind === 'chore' ? 'Not done (carried over)' : 'Not done', allowed: 'Allowed', blank: 'Not answered', open: 'Still open', off: 'Day off', none: 'Not due' };
}

function legendFor(h: Habit): DayState[] {
  if (h.kind === 'avoid') return h.weeklyLimit ? ['done', 'missed', 'allowed', 'blank', 'off'] : ['done', 'missed', 'blank', 'off'];
  return ['done', 'missed', 'open', 'off'];
}

function Calendar({ summary, habit }: { summary: Summary; habit: Habit }) {
  const today = summary.today;
  const first = monthOf(summary.evals[0]?.date ?? today);
  const last = monthOf(today);
  const [month, setMonth] = useState(last);
  const [picked, setPicked] = useState<DateKey | null>(null);
  const cells = monthDays(summary, habit.id, month);
  const words = stateWords(habit);
  const count = (s: DayState) => cells.filter((c) => c?.state === s).length;
  const shift = (n: number) => {
    setMonth(dayjs(month).add(n, 'month').format('YYYY-MM-DD'));
    setPicked(null);
  };
  const sub =
    habit.kind === 'avoid'
      ? `${count('done')} clean · ${count('missed') + count('allowed')} ${slipNoun(habit)}`
      : habit.kind === 'time'
        ? `${count('done')} on target · ${count('missed')} late`
        : `${count('done')} done · ${count('missed')} missed`;
  return (
    <Panel
      title={fmt(month, 'MMMM YYYY')}
      sub={`${sub} · tap a day`}
      right={
        <Group gap={2} wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" disabled={month <= first} onClick={() => shift(-1)} aria-label="Previous month">
            <IconChevronLeft size={18} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" disabled={month >= last} onClick={() => shift(1)} aria-label="Next month">
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      }
    >
      <div className="cal">
        {HEADS.map((d, i) => (
          <span key={i} className="cal-head" aria-hidden>
            {d}
          </span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`pad${i}`} />;
          const day = Number(c.date.slice(8));
          const tracked = c.date <= today && !!summary.evalByDate[c.date];
          const label = `${fmt(c.date, 'ddd D MMM')}: ${tracked ? words[c.state] : 'not tracked'}`;
          const mark = c.state === 'missed' ? '✕' : c.state === 'allowed' ? '•' : null;
          return tracked ? (
            <Tap key={c.date} className="cal-day" data-state={c.state} data-today={c.date === today || undefined} data-picked={c.date === picked || undefined} onClick={() => setPicked(c.date === picked ? null : c.date)} aria-label={label} aria-pressed={c.date === picked}>
              {day}
              {mark && <span className="cal-mark">{mark}</span>}
            </Tap>
          ) : (
            <span key={c.date} className="cal-day" data-state="none" aria-label={label}>
              {day}
            </span>
          );
        })}
      </div>
      <div className="cal-legend">
        {legendFor(habit).map((s) => (
          <span key={s} className="cal-key">
            <i className="cal-swatch" data-state={s} />
            {words[s]}
          </span>
        ))}
      </div>
      {picked && <DayDetail summary={summary} habit={habit} date={picked} words={words} />}
    </Panel>
  );
}

/** One day for this habit: how it went, the details, and a way to open it. */
function DayDetail({ summary, habit, date, words }: { summary: Summary; habit: Habit; date: DateKey; words: Record<DayState, string> }) {
  const idx = summary.habits.findIndex((h) => h.id === habit.id);
  const e = summary.evalByDate[date];
  const log = e?.log;
  const state = dayState(summary, idx, e);
  const bits: string[] = [];
  if (habit.kind === 'avoid') {
    const urges = log?.urges?.[habit.id] ?? 0;
    if (urges) bits.push(`💪 ${plural(urges, 'craving')} beaten`);
    const fine = summary.slipFines.find((f) => f.date === date && f.habit.id === habit.id);
    if (fine) bits.push(`💷 £${fine.amount} to charity`);
  } else if (habit.kind === 'time') {
    const time = loggedTime(habit.id, log);
    if (time) bits.push(`${habit.id === 'sleep' ? 'asleep' : 'up'} ${clockLabel(time)} · ${offBy(habit.id, time, targetFor(habit.id, summary.settings, date))}${log?.sleepAuto ? ' · ⌚' : ''}`);
    const n = nightOf(log);
    if (n.mins != null) bits.push(`${formatDuration(n.mins)} asleep`);
  } else if (habit.kind === 'water' || habit.kind === 'count') {
    bits.push(`${habit.kind === 'water' ? (log?.water ?? 0) : (log?.counts?.[habit.id] ?? 0)}/${targetOf(habit)}`);
  } else {
    const at = log?.doneAt?.[habit.id];
    if (at && state === 'done') bits.push(`ticked off at ${dayjs(at).format('h:mma')}`);
    const late = e?.items[idx]?.overdueDays ?? 0;
    if (late > 0) bits.push(`${late}d overdue`);
  }
  const note = log?.note?.trim();
  return (
    <div className="cal-detail">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Text fw={800} size="sm">
            {relativeDay(date, summary.today)} ·{' '}
            <span className="cal-word" data-state={state}>
              {words[state]}
            </span>
          </Text>
          {bits.length > 0 && (
            <Text size="xs" c="dimmed" fw={600} mt={2}>
              {bits.join(' · ')}
            </Text>
          )}
          {note && (
            <Text size="xs" mt={4} fs="italic" lineClamp={3}>
              “{note}”
            </Text>
          )}
        </div>
        <Button
          size="compact-sm"
          variant="light"
          style={{ flexShrink: 0 }}
          onClick={() => {
            useUi.setState({ statsHabit: null });
            openDay(date);
          }}
        >
          Open day
        </Button>
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Patterns, days of the week, cravings, slips, runs, money
// ---------------------------------------------------------------------------

function Patterns({ list }: { list: Pattern[] }) {
  return (
    <Panel title="🧠 Patterns" sub="From your own days in this stretch">
      {list.length ? (
        list.map((p) => (
          <div key={p.id} className="hrow">
            <div className="hrow-main" style={{ minHeight: 0 }}>
              <Tile emoji={p.emoji} color={p.tone === 'good' ? 'teal' : p.tone === 'bad' ? 'orange' : 'violet'} size={32} />
              <Text size="sm" fw={600} lh={1.4} style={{ flex: 1 }}>
                {p.text}
              </Text>
            </div>
          </div>
        ))
      ) : (
        <Text size="sm" c="dimmed">
          Nothing stands out yet. Patterns show up once there are a couple of weeks behind them — try All time.
        </Text>
      )}
    </Panel>
  );
}

function WeekdayBars({ items, max, tone }: { items: { day: number; value: number | null; text: string }[]; max: number; tone?: 'bad' }) {
  return (
    <div className="wbars" data-tone={tone}>
      {items.map((it) => (
        <div key={it.day} className="wbar" title={`${WEEKDAYS[it.day]}: ${it.text}`} aria-label={`${WEEKDAYS[it.day]}: ${it.text}`}>
          <span className="wbar-val">{it.text}</span>
          <div className="wbar-track">
            <span style={{ height: `${it.value && max ? Math.max(6, (it.value / max) * 100) : 0}%` }} />
          </div>
          <span className="wbar-day">{WEEKDAYS[it.day].slice(0, 3)}</span>
        </div>
      ))}
    </div>
  );
}

function Weekdays({ summary, habit, from }: { summary: Summary; habit: Habit; from: DateKey }) {
  const week = byWeekday(summary, habit.id, from);
  if (habit.kind === 'avoid') {
    const slips = week.map((w) => w.missed + w.allowed);
    const total = slips.reduce((a, b) => a + b, 0);
    if (!total) return null;
    return (
      <Panel title={`${habit.id === 'alcohol' ? 'Drinking nights' : 'Slips'} by day of the week`} sub={`${total} in this stretch`}>
        <WeekdayBars items={week.map((w, i) => ({ day: w.day, value: slips[i], text: String(slips[i]) }))} max={Math.max(...slips)} tone="bad" />
      </Panel>
    );
  }
  if (!week.some((w) => w.judged)) return null;
  return (
    <Panel title="By day of the week" sub={habit.kind === 'time' ? '% of days on target' : '% of days done, when it was due'}>
      <WeekdayBars items={week.map((w) => ({ day: w.day, value: w.rate, text: w.rate == null ? '–' : `${w.rate}%` }))} max={100} />
    </Panel>
  );
}

function Cravings({ summary, habit, from }: { summary: Summary; habit: Habit; from: DateKey }) {
  const parts = cravingTimes(summary, habit.id, from);
  const total = parts.reduce((n, p) => n + p.count, 0);
  if (!total) return null;
  const top = Math.max(...parts.map((p) => p.count));
  return (
    <Panel title="When cravings hit" sub={`${plural(total, 'craving')} beaten in this stretch, by time of day`}>
      <div className="hbars">
        {parts.map((p) => (
          <div key={p.id} className="hbar" data-top={(p.count === top && top > 0) || undefined}>
            <span className="hbar-label">
              {p.emoji} {p.name}
            </span>
            <div className="hbar-track">
              <span style={{ width: `${top ? (p.count / top) * 100 : 0}%` }} />
            </div>
            <span className="hbar-val">{p.count}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Slips({ summary, habit, from }: { summary: Summary; habit: Habit; from: DateKey }) {
  const [all, setAll] = useState(false);
  const log = slipLog(summary, habit.id, from);
  if (!log.length) return null;
  const shown = all ? log : log.slice(0, 5);
  return (
    <Panel title={habit.id === 'alcohol' ? 'Every drinking night' : 'Every slip'} sub="Newest first, with what else was going on">
      {shown.map((s) => (
        <div key={s.date} className="hrow">
          <div className="hrow-main" style={{ minHeight: 0, alignItems: 'flex-start' }}>
            <div className="slip-date" data-allowed={s.allowed || undefined}>
              <b>{fmt(s.date, 'D')}</b>
              <span>{fmt(s.date, 'MMM')}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={700}>
                {fmt(s.date, 'dddd')}
                {s.allowed ? ' · inside your allowance' : ''}
              </Text>
              <Meta>
                {s.lateNight && <M>🌙 after a late night</M>}
                {s.drinking && <M>🍺 drinking that day</M>}
                {s.urges > 0 && <M>💪 {plural(s.urges, 'craving')} beaten</M>}
                {s.fine > 0 && <M tone="bad">£{s.fine} to charity</M>}
              </Meta>
              {s.note && (
                <Text size="xs" c="dimmed" fs="italic" lineClamp={2} mt={2}>
                  “{s.note}”
                </Text>
              )}
            </div>
          </div>
        </div>
      ))}
      {log.length > 5 && (
        <Button variant="subtle" size="xs" fullWidth mt={4} onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${log.length}`}
        </Button>
      )}
    </Panel>
  );
}

function Runs({ summary, habit }: { summary: Summary; habit: Habit }) {
  const list = runs(summary, habit.id).slice(0, 5);
  if (!list.length) return null;
  const longest = list[0].length;
  return (
    <Panel title="Longest runs" sub="Days in a row · all time">
      <Stack gap={10}>
        {list.map((r) => (
          <div key={r.from}>
            <Group justify="space-between" wrap="nowrap" gap="xs" mb={4}>
              <Text size="sm" fw={800}>
                {r.current && <span className="flame">🔥 </span>}
                {plural(r.length, 'day')}
              </Text>
              <Text size="xs" c="dimmed" fw={600}>
                {r.from === r.to ? fmt(r.from, 'D MMM') : `${fmt(r.from, 'D MMM')} – ${r.current ? 'now' : fmt(r.to, 'D MMM')}`}
              </Text>
            </Group>
            <Bar value={(r.length / longest) * 100} color={r.current ? 'orange' : 'gray'} h={5} />
          </div>
        ))}
      </Stack>
    </Panel>
  );
}

function Money({ summary, habit }: { summary: Summary; habit: Habit }) {
  const perWeek = summary.settings.costPerWeek?.[habit.id] ?? 0;
  const rule = summary.settings.slipFines?.[habit.id];
  const fines = summary.slipFines.filter((f) => f.habit.id === habit.id).reduce((n, f) => n + f.amount, 0);
  if (!perWeek && !rule && !fines) return null;
  const saved = slipStats(summary).find((s) => s.habit.id === habit.id)?.saved ?? 0;
  return (
    <Panel title="Money" sub="All time">
      <SimpleGrid cols={2} spacing="xs">
        {perWeek > 0 && (
          <div className="stats-tile" style={{ background: 'var(--surface)' }}>
            <div className="stats-tile-value" data-tone="good">
              £{saved}
            </div>
            <div className="stats-tile-label">kept by staying clean</div>
            <div className="stats-tile-sub">it cost you £{perWeek} a week</div>
          </div>
        )}
        {(rule || fines > 0) && (
          <div className="stats-tile" style={{ background: 'var(--surface)' }}>
            <div className="stats-tile-value" data-tone={fines ? 'bad' : undefined}>
              £{fines}
            </div>
            <div className="stats-tile-label">in slip fines</div>
            <div className="stats-tile-sub">{rule ? `£${rule.amount} a slip, to ${summary.settings.charity}` : 'from before'}</div>
          </div>
        )}
      </SimpleGrid>
    </Panel>
  );
}
