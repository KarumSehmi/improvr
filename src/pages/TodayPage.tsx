import { Alert, Button, Card, Group, SegmentedControl, Stack, Text, Textarea } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef, useState } from 'react';
import HabitRow from '../components/HabitRow';
import HeroCard from '../components/HeroCard';
import LockInCard from '../components/LockInCard';
import SectionCard from '../components/SectionCard';
import TrainingCard from '../components/TrainingCard';
import UpcomingCard, { BirthdayBanner } from '../components/UpcomingCard';
import { HABITS, SECTIONS, STREAK_MILESTONES } from '../lib/config';
import { burst, fireworks } from '../lib/celebrate';
import { addDays, fmt, formatCountdown, logDeadline, type DateKey } from '../lib/dates';
import { isOpen, type DayEval, type Streak } from '../lib/engine';
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
function useCelebrations(date: DateKey, e: DayEval | undefined, streaks: Record<string, Streak>, open: boolean) {
  const prev = useRef<{ date: DateKey; sections: Record<string, boolean>; perfect: boolean; streaks: Record<string, Streak> } | null>(
    null,
  );
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
    for (const h of HABITS) {
      const n = streaks[h.id]?.current ?? 0;
      if (n > (p.streaks[h.id]?.current ?? 0) && STREAK_MILESTONES.includes(n)) {
        notifications.show({ color: 'orange', title: `🔥 ${n}-day streak!`, message: `${h.emoji} ${h.label}` });
      }
    }
  }, [date, e, streaks, open]);
}

function NoteCard({ date, note }: { date: DateKey; note: string }) {
  const [value, setValue] = useState(note);
  const [editingDate, setEditingDate] = useState(date);
  if (editingDate !== date) {
    setEditingDate(date);
    setValue(note);
  }
  const save = useDebouncedCallback((v: string) => updateDay(date, (l) => void (l.note = v)), { delay: 600, flushOnUnmount: true });
  return (
    <Card p="sm">
      <Text fw={800} px={4}>
        📝 How can I be better tomorrow?
      </Text>
      <Textarea
        mt="xs"
        autosize
        minRows={2}
        maxRows={6}
        placeholder="One thing to do better tomorrow…"
        value={value}
        onChange={(ev) => {
          setValue(ev.currentTarget.value);
          save(ev.currentTarget.value);
        }}
        onBlur={() => save.flush()}
      />
    </Card>
  );
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

  useCelebrations(date, e, summary.habitStreaks, open);

  const switcher =
    date === today || date === yesterday ? (
      <SegmentedControl
        fullWidth
        radius="xl"
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
          {date > today
            ? 'Come back on the day.'
            : `Tracking started on ${fmt(settings.startDate, 'D MMM YYYY')}. You can change the start date in More.`}
        </Alert>
      </Stack>
    );
  }

  const prevNote = days[addDays(date, -1)]?.note;
  const lastWeight = lastWeightBefore(days, date);
  const otherPending = summary.openUnlogged.filter((d) => d !== date);

  return (
    <Stack gap="md">
      <HeroCard date={date} evaluation={e} summary={summary} name={settings.name} />

      {summary.owed > 0 && (
        <Alert color="red" variant="light" title={`You owe £${summary.owed} to ${settings.charity}`} icon="💷">
          <Text size="sm">
            {summary.fineDays.length} unlogged day{summary.fineDays.length === 1 ? '' : 's'} so far. Donate it, then mark it paid.
          </Text>
          <Button size="xs" color="red" mt="xs" onClick={() => goTo('more')}>
            I've paid / see details
          </Button>
        </Alert>
      )}

      {otherPending.map((d) => (
        <Alert key={d} color="orange" variant="light" title={`${d === yesterday ? 'Yesterday' : fmt(d, 'dddd')} isn't logged yet`} icon="⏳">
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

      {prevNote && (
        <Card p="sm" style={{ borderStyle: 'dashed' }}>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Your note to self from {date === today ? 'yesterday' : 'the day before'}
          </Text>
          <Text size="sm" mt={4}>
            {prevNote}
          </Text>
        </Card>
      )}

      {SECTIONS.map((sec) => {
        const items = e.items.filter((i) => i.habit.section === sec.id && i.visible);
        const req = items.filter((i) => i.required);
        return (
          <Stack key={sec.id} gap="md">
            <SectionCard
              id={sec.id}
              emoji={sec.emoji}
              title={sec.title}
              subtitle={sec.subtitle}
              done={req.filter((i) => i.done).length}
              total={req.length}
            >
              {items.map((item) => (
                <HabitRow
                  key={item.habit.id}
                  item={item}
                  date={date}
                  log={e.log}
                  streak={summary.habitStreaks[item.habit.id]}
                  lastWeight={lastWeight}
                />
              ))}
            </SectionCard>
            {sec.id === 'day' && <TrainingCard date={date} streak={summary.trainingStreak} />}
          </Stack>
        );
      })}

      <NoteCard date={date} note={e.log?.note ?? ''} />

      <LockInCard date={date} evaluation={e} />

      {date === today && <UpcomingCard today={today} summary={summary} />}
    </Stack>
  );
}
