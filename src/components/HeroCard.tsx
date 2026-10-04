import { Card, Group, RollingNumber, Stack, Text } from '@mantine/core';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { scrollToAndFlash } from '../lib/actions';
import { SECTIONS, featureOn, type Habit } from '../lib/config';
import { addDays, weekStart, type DateKey } from '../lib/dates';
import { totalSaved, type DayEval, type Summary } from '../lib/engine';
import { useNow, useUi } from '../lib/hooks';
import { dayProgress, daypart, hatTrickStreak, logicalNow, pace, sectionLater, sectionStatus } from '../lib/moments';
import { useApp } from '../lib/store';
import CheckinStrip from './Checkins';
import { ScoreRing, Tap, accent } from './ui';

interface Props {
  date: DateKey;
  evaluation: DayEval;
  yesterdayPct: number | null;
  summary: Summary;
  focus: { habit: Habit; done: number; required: number } | null;
}

/** You vs yesterday-you at this exact time of day. */
function Race({ you, them, final, total }: { you: number; them: number; final: number; total: number }) {
  const diff = you - them;
  const max = Math.max(total, final, you, 1);
  return (
    <div>
      <Text size="sm" fw={800} c={diff > 0 ? 'var(--good)' : diff < 0 ? 'var(--warn)' : undefined} lh={1.25}>
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

/** Each part of the day as a little ring. Tap one to jump to it (and unfold it if it's waiting for later). */
function Parts({ e, live, hour, summary }: { e: DayEval; live: boolean; hour: number; summary: Summary }) {
  const days = useApp((s) => s.days);
  const target = summary.settings.workoutTarget;
  const ws = weekStart(e.date);
  const sessions = [0, 1, 2, 3, 4, 5, 6].filter((i) => days[addDays(ws, i)]?.workouts?.includes('gym')).length;
  const go = (id: string, section?: string) => {
    if (section) useUi.setState({ openSection: section });
    setTimeout(() => scrollToAndFlash(id), 60);
  };

  return (
    <div className="parts">
      {SECTIONS.map((sec) => {
        const st = sectionStatus(e, sec.id);
        if (!st.items.length) return null;
        const later = live && !st.closed && sectionLater(sec.id, hour, summary.settings);
        const state = st.complete ? 'done' : st.closed ? 'closed' : later ? 'later' : 'left';
        return (
          <Tap key={sec.id} className="part" data-later={later || undefined} data-state={state} style={accent(sec.color)} onClick={() => go(`section-${sec.id}`, sec.id)} aria-label={`${sec.title}: ${st.done} of ${st.total}`}>
            <ScoreRing value={st.total ? (st.done / st.total) * 100 : 100} size={40} stroke={3.5} color={st.complete ? 'teal' : sec.color}>
              <Text fz={st.complete ? 15 : 18} lh={1} fw={900} c={st.complete ? 'var(--good)' : undefined}>
                {st.complete ? '✓' : sec.emoji}
              </Text>
            </ScoreRing>
            <span className="part-label">{sec.short}</span>
            <span className="part-sub">{st.complete ? 'done' : st.closed ? 'closed' : later ? 'later' : `${st.open.length} left`}</span>
          </Tap>
        );
      })}
      {target > 0 && (
        <Tap className="part" data-state={sessions >= target ? 'done' : 'left'} style={accent('lime')} onClick={() => go('training')} aria-label={`Training: ${sessions} of ${target} this week`}>
          <ScoreRing value={Math.min(100, (sessions / target) * 100)} size={40} stroke={3.5} color={sessions >= target ? 'teal' : 'lime'}>
            <Text fz={sessions >= target ? 15 : 18} lh={1} fw={900} c={sessions >= target ? 'var(--good)' : undefined}>
              {sessions >= target ? '✓' : '🏋️'}
            </Text>
          </ScoreRing>
          <span className="part-label">Gym</span>
          <span className="part-sub">
            {sessions}/{target} wk
          </span>
        </Tap>
      )}
    </div>
  );
}

function Pill({ emoji, children, onClick }: { emoji: string; children: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span style={{ fontSize: 15 }}>{emoji}</span>
      <span>{children}</span>
    </>
  );
  return onClick ? (
    <Tap className="stat-pill" onClick={onClick}>
      {body}
    </Tap>
  ) : (
    <div className="stat-pill">{body}</div>
  );
}

export default function HeroCard({ date, evaluation: e, yesterdayPct, summary, focus }: Props) {
  const now = useNow();
  const clock = new Date(now);
  const part = daypart(clock);
  const moment = logicalNow(clock);
  const live = moment.date === date;
  const pct = e.pct ?? 0;
  const { settings } = summary;
  const race = live && !e.dayOff && featureOn(settings, 'race') ? pace(e, summary.evalByDate[addDays(date, -1)], now) : null;
  // The yellow notch is yesterday-you: where they were by now (or their final score).
  const marker = e.dayOff ? null : race && e.required ? Math.min(100, (race.them / e.required) * 100) : yesterdayPct;
  const beating = yesterdayPct != null && pct > yesterdayPct;

  // The sun (moon at night) arcs across the card through the day.
  const p = dayProgress(clock);
  const sun = { left: `${8 + p * 84}%`, top: `${58 - Math.sin(Math.PI * p) * 48}%` };

  return (
    <Card className="hero" p="md" pt="lg">
      {live && <div className="hero-sun" style={sun} />}
      {live && part === 'night' && <div className="hero-stars" />}

      <Group wrap="nowrap" gap="lg" align="center" px={4}>
        <ScoreRing value={e.dayOff ? 100 : pct} marker={marker} size={112} stroke={11} color={e.dayOff ? 'blue' : pct >= 100 ? 'teal' : 'brand'}>
          <Stack gap={0} align="center">
            <Text fz={30} fw={900} lh={1} className="num" lts={-1}>
              {e.dayOff ? '🏖️' : `${pct}%`}
            </Text>
            <Text fz={11} c="dimmed" fw={700} mt={4} tt="uppercase" lts={0.6}>
              {e.dayOff ? 'day off' : e.perfect ? 'perfect' : 'done'}
            </Text>
          </Stack>
        </ScoreRing>

        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Text fz={21} fw={850} lh={1.15} lts={-0.4}>
            {e.dayOff ? 'Day off' : (
              <>
                <span className="num">{e.completed}</span>
                <Text span c="dimmed" fw={700} fz={17}>
                  {' '}
                  of {e.required} done
                </Text>
              </>
            )}
          </Text>
          <Group gap={4} align="baseline" wrap="nowrap">
            <Text fw={900} fz={17} lh={1} c="var(--xp)">
              +
            </Text>
            <RollingNumber value={e.points} fw={900} fz={17} lh={1} c="var(--xp)" />
            <Text fw={750} fz={13} c="dimmed" ml={2}>
              XP {live ? 'today' : 'this day'}
            </Text>
          </Group>
          {race ? (
            <Race you={race.you} them={race.them} final={race.final} total={e.required} />
          ) : (
            !e.dayOff &&
            yesterdayPct != null && (
              <Text size="sm" fw={750} c={beating ? 'var(--good)' : 'dimmed'}>
                {beating ? '✓ Better than yesterday' : (
                  <>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: 'var(--mantine-color-yellow-4)', marginRight: 6 }} />
                    Beat yesterday: {yesterdayPct}%
                  </>
                )}
              </Text>
            )
          )}
        </Stack>
      </Group>

      {!e.dayOff && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <Parts e={e} live={live} hour={moment.hour} summary={summary} />
        </div>
      )}

      {featureOn(settings, 'checkins') && (live || e.checkins > 0) && (
        <div style={{ marginTop: 12 }}>
          <CheckinStrip date={date} log={e.log} />
        </div>
      )}

      {focus && (
        <Text size="xs" fw={750} mt={12} c="dimmed" ta="center">
          🎯 This week's focus: <Text span fw={850} c="var(--mantine-color-text)">{focus.habit.label}</Text> · {focus.done}/{focus.required}
        </Text>
      )}
    </Card>
  );
}

/** Streaks and savings worth seeing every day, in a scrollable row under the hero. */
export function StatPills({ summary }: { summary: Summary }) {
  const { logStreak, habitStreaks, trainingStreak } = summary;
  const vape = summary.habits.some((h) => h.id === 'vape') ? habitStreaks.vape : null;
  const saved = totalSaved(summary);
  const hatTricks = featureOn(summary.settings, 'checkins') ? hatTrickStreak(summary.evals) : 0;
  const toProgress = () => useUi.setState({ page: 'progress' });
  return (
    <div className="chip-row bleed">
      <Pill emoji="🔥" onClick={toProgress}>
        <b>{logStreak.current}</b>-day streak
      </Pill>
      {vape && (
        <Pill emoji="🚭" onClick={toProgress}>
          <b>{vape.current}</b> nicotine-free
        </Pill>
      )}
      {saved != null && saved > 0 && (
        <Pill emoji="💰" onClick={() => useUi.setState({ page: 'progress', progressTab: 'money' })}>
          <b>£{saved}</b> saved
        </Pill>
      )}
      <Pill emoji="💪" onClick={toProgress}>
        <b>{trainingStreak.current}</b> wk gym streak
      </Pill>
      {hatTricks >= 2 && (
        <Pill emoji="🎯">
          <b>{hatTricks}</b>-day hat-trick
        </Pill>
      )}
    </div>
  );
}
