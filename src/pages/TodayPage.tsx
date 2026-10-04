import { Alert, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEye, IconEyeOff, IconPlayerPlayFilled } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { DayHeader, WeekStrip } from '../components/DayHeader';
import HabitRow from '../components/HabitRow';
import HeroCard, { StatPills } from '../components/HeroCard';
import Notice from '../components/Notice';
import QuestCard from '../components/QuestCard';
import SectionCard from '../components/SectionCard';
import TodoCard from '../components/Todos';
import TrainingCard from '../components/TrainingCard';
import UpNextCard from '../components/UpNextCard';
import WrapUpCard from '../components/WrapUpCard';
import { Tap, accent } from '../components/ui';
import { markNotDone, tickAll } from '../lib/actions';
import { birthdaysOn } from '../lib/calendar';
import { QUOTE, SECTIONS, STREAK_MILESTONES, featureOn, sectionHour } from '../lib/config';
import { burst, fireworks } from '../lib/celebrate';
import { addDays, fmt, formatCountdown, logDeadline, relativeDay, weekStart, type DateKey } from '../lib/dates';
import { isOpen, weekStats, type DayEval, type Streak, type Summary } from '../lib/engine';
import { goTo, logDate, openDay, openSos, setHideDone, useNow, useSummary, useToday, useUi } from '../lib/hooks';
import { lockDay } from '../lib/lock';
import { logicalNow, sectionLater, sectionStatus } from '../lib/moments';
import { updateDay, useApp } from '../lib/store';

const hourLabel = (h: number) => (h % 12 || 12) + (h % 24 < 12 ? 'am' : 'pm');

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
  const hideDone = useUi((s) => s.hideDone);
  const summary = useSummary();
  const days = useApp((s) => s.days);
  const settings = useApp((s) => s.settings);
  const birthdays = useApp((s) => s.birthdays);

  const date = viewDate ?? logDate(now, summary);
  const e = summary.evalByDate[date];
  const open = isOpen(date, today);
  // Is this day "now"? (Up past midnight still counts as the day before.) Then things not due yet fold away.
  const moment = logicalNow(new Date(now));
  const live = date === moment.date;
  const evening = !live || moment.hour >= 18;

  useCelebrations(date, e, summary, open);

  const header = (
    <>
      <DayHeader date={date} summary={summary} />
      <WeekStrip selected={date} summary={summary} />
    </>
  );

  if (!e) {
    return (
      <Stack gap={14}>
        {header}
        <Alert color="gray" title={date > today ? "Can't log the future" : 'Before you started'} radius="lg">
          {date > today ? 'Come back on the day.' : `Tracking started on ${fmt(settings.startDate, 'D MMM YYYY')}. You can change the start date in Settings.`}
        </Alert>
      </Stack>
    );
  }

  const prevNote = days[addDays(date, -1)]?.note?.trim();
  const otherPending = summary.openUnlogged.filter((d) => d !== date && d !== today);
  const yesterdayPct = summary.evalByDate[addDays(date, -1)]?.pct ?? null;

  const ws = weekStart(today);
  const focusId = settings.focus?.week === ws ? settings.focus.habitId : null;
  const focusRate = focusId ? weekStats(summary, ws).rates.find((r) => r.habit.id === focusId) : undefined;
  const focus = focusRate ? { habit: focusRate.habit, done: focusRate.done, required: focusRate.required } : null;
  const outside = date < addDays(today, -6);
  const bdays = date === today ? birthdaysOn(birthdays, today) : [];
  const left = e.items.filter((i) => i.required && !i.done && !i.missed && !i.skipped).length;
  const sos = featureOn(settings, 'sos');

  return (
    <Stack gap={14}>
      {header}

      {outside && <Notice emoji="📅" color="violet" title={`Viewing ${fmt(date, 'dddd D MMM YYYY')}`} action={{ label: 'Today', onClick: () => openDay(null) }} />}
      {summary.owed > 0 && (
        <Notice
          emoji="💷"
          color="red"
          title={`You owe £${summary.owed} to ${settings.charity}`}
          sub={`${summary.fineDays.length} day${summary.fineDays.length === 1 ? '' : 's'} not locked in on time`}
          action={{ label: 'Pay', onClick: () => goTo('progress', { progressTab: 'money' }) }}
        />
      )}
      {otherPending.map((d) => (
        <Notice
          key={d}
          emoji="⏳"
          title={`${relativeDay(d, today)} isn't locked in`}
          sub={`${formatCountdown(logDeadline(d) - now)} left before it costs £${settings.fineAmount}`}
          action={{ label: 'Log it', onClick: () => openDay(d) }}
        />
      ))}
      {bdays.length > 0 && <Notice emoji="🎂" color="pink" title={`It's ${bdays.map((b) => b.name).join(' & ')}'s birthday today`} sub="Send a message!" />}

      <HeroCard date={date} evaluation={e} yesterdayPct={yesterdayPct} summary={summary} focus={focus} />
      <StatPills summary={summary} />

      {prevNote && (
        <div style={{ ...accent('violet'), borderLeft: '3px solid var(--accent)', padding: '2px 0 2px 12px' }}>
          <div className="eyebrow">Note from {date === today ? 'yesterday' : 'the day before'}</div>
          <Text size="sm" fw={650} mt={2}>
            {prevNote}
          </Text>
        </div>
      )}

      {open && <UpNextCard date={date} evaluation={e} summary={summary} onLock={() => lockDay(date, e, open)} />}

      {date === today && <TodoCard today={today} />}

      {!e.dayOff && (
        <Group justify="space-between" mt={4} px={2}>
          <div className="eyebrow">
            Your list · {e.completed}/{e.required}
          </div>
          <Group gap={6}>
            {open && left > 0 && (
              <Tap className="chip" data-small onClick={() => useUi.setState({ wrapDate: date })}>
                <IconPlayerPlayFilled size={11} /> Go through {left}
              </Tap>
            )}
            <Tap className="chip" data-small data-active={hideDone || undefined} onClick={() => setHideDone(!hideDone)} aria-pressed={hideDone}>
              {hideDone ? <IconEyeOff size={13} /> : <IconEye size={13} />} {hideDone ? 'Done hidden' : 'Hide done'}
            </Tap>
          </Group>
        </Group>
      )}

      {SECTIONS.map((sec) => {
        const status = sectionStatus(e, sec.id);
        const { items, open: left } = status;
        if (!items.length) return null;
        const quickable = left.filter((i) => (sec.id === 'clean' ? i.habit.kind === 'avoid' : ['check', 'chore', 'dose'].includes(i.habit.kind) && !i.habit.skippable));
        // Stayed clean always needs an honest answer, so it can't just be closed.
        const closable = left.length > 0 && left.every((i) => i.habit.kind !== 'avoid');
        const reason = sec.id === 'clean' && summary.habits.some((h) => h.id === 'vape') ? settings.reasons?.vape : null;
        return (
          <Stack key={sec.id} gap={14}>
            <SectionCard
              id={sec.id}
              emoji={sec.emoji}
              title={sec.title}
              subtitle={reason ? `🚭 ${reason}` : sec.subtitle}
              color={sec.color}
              status={status}
              quick={
                quickable.length >= 2
                  ? { label: sec.id === 'clean' ? 'All clean' : 'All ✓', onClick: (ev) => tickAll(date, quickable.map((i) => i.habit), ev) }
                  : null
              }
              later={live && !status.closed && sectionLater(sec.id, moment.hour, settings) ? `from ${hourLabel(sectionHour(settings, sec.id))}` : null}
              onCloseRest={closable ? () => markNotDone(date, left.map((i) => i.habit)) : null}
              dayClosed={e.closed}
              rows={items.map((item) => {
                const streak = summary.habitStreaks[item.habit.id];
                return {
                  id: item.habit.id,
                  done: item.done || item.skipped,
                  node: (
                    <HabitRow
                      key={item.habit.id}
                      item={item}
                      date={date}
                      log={e.log}
                      streak={streak}
                      color={sec.color}
                      focus={item.habit.id === focusId}
                      atRisk={live && moment.hour >= 18 && streak.current >= 3 && !item.done && !item.missed && item.required}
                    />
                  ),
                };
              })}
              footer={
                sec.id === 'clean' && sos ? (
                  <Tap onClick={() => openSos()} className="chip" style={{ ...accent('red'), width: '100%', justifyContent: 'center', marginTop: 8, color: 'var(--accent-text)', background: 'var(--accent-soft)' }}>
                    🆘 Craving? Ride it out for 10 minutes
                  </Tap>
                ) : null
              }
            />
            {sec.id === 'day' && settings.workoutTarget > 0 && <TrainingCard date={date} streak={summary.trainingStreak} />}
          </Stack>
        );
      })}

      {featureOn(settings, 'quest') && open && !e.dayOff && <QuestCard date={date} log={e.log} />}

      <WrapUpCard date={date} evaluation={e} early={!evening} />

      <Text size="xs" c="dimmed" ta="center" fs="italic" mt="sm">
        “{QUOTE}”
      </Text>
      <Text size="xs" c="dimmed" ta="center" mt={-8} style={{ opacity: 0.7 }}>
        Tip: press and hold anything for more options
      </Text>
    </Stack>
  );
}
