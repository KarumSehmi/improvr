import { Alert, Button, Card, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef } from 'react';
import HabitRow from '../components/HabitRow';
import HeroCard from '../components/HeroCard';
import LockInCard from '../components/LockInCard';
import ReflectionCard from '../components/ReflectionCard';
import SectionCard from '../components/SectionCard';
import TrainingCard from '../components/TrainingCard';
import UpNextCard from '../components/UpNextCard';
import UpcomingCard, { BirthdayBanner } from '../components/UpcomingCard';
import { tickAll } from '../lib/actions';
import { lockDay } from '../lib/lock';
import { SECTIONS, STREAK_MILESTONES } from '../lib/config';
import { burst, fireworks } from '../lib/celebrate';
import { addDays, fmt, formatCountdown, logDeadline, weekStart, type DateKey } from '../lib/dates';
import { isOpen, weekStats, type DayEval, type Streak, type Summary } from '../lib/engine';
import { goTo, openDay, useNow, useSummary, useToday, useUi } from '../lib/hooks';
import { updateDay, useApp } from '../lib/store';
import type { DayLog } from '../lib/types';

function lastWeightBefore(days: Record<DateKey, DayLog>, date: DateKey): number | null {
  let best: DateKey | null = null;
  for (const [d, log] of Object.entries(days)) {
    if (d < date && log.weight && (!best || d > best)) best = d;
  }
  return best ? (days[best].weight ?? null) : null;
}

function sectionsComplete(e: DayEval): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const s of SECTIONS) {
    const req = e.items.filter((i) => i.habit.section === s.id && i.required);
    out[s.id] = req.length > 0 && req.every((i) => i.done);
  }
  return out;
}

/** Confetti + toasts when something good happens (derived from state changes, so it works from any tap). */
function useCelebrations(date: DateKey, e: DayEval | undefined, summary: Summary, open: boolean) {
  const streaks = summary.habitStreaks;
  const prev = useRef<{ date: DateKey; sections: Record<string, boolean>; perfect: boolean; streaks: Record<string, Streak> } | null>(null);
  useEffect(() => {
    if (!e) return;
    const sections = sectionsComplete(e);
    const p = prev.current;
    prev.current = { date, sections, perfect: e.perfect, streaks };

    // A perfect day locks itself in.
    if (e.perfect && !e.closed && open) {
      updateDay(date, (l) => {
        l.closedAt ??= Date.now();
      });
    }
    if (!p || p.date !== date) return;

    if (e.perfect && !p.perfect) {
      fireworks();
      notifications.show({ color: 'yellow', title: '🏆 Perfect day!', message: '+25 bonus XP. This is who you are now.' });
      return;
    }
    for (const s of SECTIONS) {
      if (sections[s.id] && !p.sections[s.id]) {
        burst();
        notifications.show({ color: 'teal', title: `${s.emoji} ${s.title} done!`, message: 'Keep the momentum going.' });
      }
    }
    for (const h of summary.habits) {
      const n = streaks[h.id]?.current ?? 0;
      if (n > (p.streaks[h.id]?.current ?? 0) && STREAK_MILESTONES.includes(n)) {
        notifications.show({ color: 'orange', title: `🔥 ${n}-day streak!`, message: `${h.emoji} ${h.label}` });
      }
    }
  }, [date, e, streaks, open, summary.habits]);
}

export default function TodayPage() {
  const today = useToday();
  const now = useNow();
  const viewDate = useUi((s) => s.viewDate);
  const summary = useSummary();
  const days = useApp((s) => s.days);
  const settings = useApp((s) => s.settings);

  const yesterday = addDays(today, -1);
  const yesterdayPending = summary.openUnlogged.includes(yesterday);
  // Up past midnight? Default to finishing off yesterday.
  const date = viewDate ?? (new Date(now).getHours() < 4 && yesterdayPending ? yesterday : today);
  const e = summary.evalByDate[date];
  const open = isOpen(date, today);
  const hour = new Date(now).getHours();

  useCelebrations(date, e, summary, open);

  const switcher =
    date === today || date === yesterday ? (
      <SegmentedControl
        fullWidth
        radius="xl"
        size="md"
        value={date}
        onChange={(v) => openDay(v)}
        data={[
          { value: yesterday, label: `Yesterday${yesterdayPending ? ' ⚠️' : ''}` },
          { value: today, label: 'Today' },
        ]}
      />
    ) : (
      <Group justify="space-between">
        <Text fw={700}>{fmt(date, 'dddd D MMM YYYY')}</Text>
        <Button size="xs" variant="light" onClick={() => openDay(null)}>
          Back to today
        </Button>
      </Group>
    );

  if (!e) {
    return (
      <Stack>
        {switcher}
        <Alert color="gray" title={date > today ? "Can't log the future" : 'Before you started'}>
          {date > today ? 'Come back on the day.' : `Tracking started on ${fmt(settings.startDate, 'D MMM YYYY')}. You can change the start date in More.`}
        </Alert>
      </Stack>
    );
  }

  const prevNote = days[addDays(date, -1)]?.note?.trim();
  const lastWeight = lastWeightBefore(days, date);
  const otherPending = summary.openUnlogged.filter((d) => d !== date);
  const yesterdayPct = summary.evalByDate[addDays(date, -1)]?.pct ?? null;

  const ws = weekStart(today);
  const focusId = settings.focus?.week === ws ? settings.focus.habitId : null;
  const focusRate = focusId ? weekStats(summary, ws).rates.find((r) => r.habit.id === focusId) : undefined;
  const focus = focusRate ? { habit: focusRate.habit, done: focusRate.done, required: focusRate.required } : null;

  return (
    <Stack gap="md">
      <HeroCard date={date} isToday={date === today} evaluation={e} yesterdayPct={yesterdayPct} summary={summary} name={settings.name} focus={focus} />

      {summary.owed > 0 && (
        <Alert color="red" variant="light" radius="lg" title={`You owe £${summary.owed} to ${settings.charity}`} icon="💷">
          <Text size="sm">
            {summary.fineDays.length} unlogged day{summary.fineDays.length === 1 ? '' : 's'}. Donate it, then mark it paid.
          </Text>
          <Group gap="xs" mt="xs">
            {settings.donateUrl && (
              <Button size="xs" color="red" component="a" href={settings.donateUrl} target="_blank" rel="noreferrer">
                Donate now
              </Button>
            )}
            <Button size="xs" color="red" variant={settings.donateUrl ? 'light' : 'filled'} onClick={() => goTo('more')}>
              I've paid
            </Button>
          </Group>
        </Alert>
      )}

      {otherPending.map((d) => (
        <Alert key={d} color="orange" variant="light" radius="lg" title={`${d === yesterday ? 'Yesterday' : fmt(d, 'dddd')} isn't logged yet`} icon="⏳">
          <Text size="sm">
            {formatCountdown(logDeadline(d) - now)} left before it costs £{settings.fineAmount}.
          </Text>
          <Button size="xs" color="orange" mt="xs" onClick={() => openDay(d)}>
            Log it now
          </Button>
        </Alert>
      ))}

      {switcher}

      {date === today && <BirthdayBanner today={today} />}

      {open && <UpNextCard date={date} evaluation={e} summary={summary} onLock={() => lockDay(date, e, open)} />}

      {prevNote && (
        <Card p="sm" style={{ borderStyle: 'dashed' }}>
          <div className="eyebrow">Note to self from {date === today ? 'yesterday' : 'the day before'}</div>
          <Text size="sm" mt={4} fw={600}>
            {prevNote}
          </Text>
        </Card>
      )}

      {SECTIONS.map((sec) => {
        const items = e.items.filter((i) => i.habit.section === sec.id && i.visible);
        if (!items.length) return null;
        const req = items.filter((i) => i.required);
        const pending = items.filter((i) => i.required && !i.done && !i.missed && !i.skipped);
        const quickable = pending.filter((i) => (sec.id === 'clean' ? i.habit.kind === 'avoid' : ['check', 'chore', 'dose'].includes(i.habit.kind) && !i.habit.skippable));
        return (
          <Stack key={sec.id} gap="md">
            <SectionCard
              id={sec.id}
              emoji={sec.emoji}
              title={sec.title}
              subtitle={sec.subtitle}
              color={sec.color}
              done={req.filter((i) => i.done).length}
              total={req.length}
              quick={
                quickable.length >= 2
                  ? { label: sec.id === 'clean' ? 'All clean' : 'All ✓', onClick: (ev) => tickAll(date, quickable.map((i) => i.habit), ev) }
                  : null
              }
            >
              {items.map((item) => {
                const streak = summary.habitStreaks[item.habit.id];
                return (
                  <HabitRow
                    key={item.habit.id}
                    item={item}
                    date={date}
                    log={e.log}
                    streak={streak}
                    lastWeight={lastWeight}
                    color={sec.color}
                    focus={item.habit.id === focusId}
                    atRisk={date === today && hour >= 18 && streak.current >= 3 && !item.done && !item.missed && item.required}
                  />
                );
              })}
            </SectionCard>
            {sec.id === 'day' && <TrainingCard date={date} streak={summary.trainingStreak} />}
          </Stack>
        );
      })}

      <ReflectionCard date={date} note={e.log?.note ?? ''} mood={e.log?.mood} />

      <LockInCard date={date} evaluation={e} />

      {date === today && <UpcomingCard today={today} summary={summary} />}
    </Stack>
  );
}
