import { Card, Text } from '@mantine/core';
import dayjs from 'dayjs';
import type { MouseEvent } from 'react';
import { addWater, logWorkout, scrollToAndFlash, tickAll } from '../lib/actions';
import type { DateKey } from '../lib/dates';
import type { DayEval, Summary } from '../lib/engine';
import { useNow, useUi } from '../lib/hooks';
import { suggestions, type Suggestion } from '../lib/smart';
import { useApp } from '../lib/store';
import { PanelHead, Tap, Tile, accent } from './ui';

const TONE = { info: 'violet', warn: 'orange', good: 'teal' } as const;

/** What matters right now, with one tap to do it. */
export default function UpNextCard({ date, evaluation, summary, onLock }: { date: DateKey; evaluation: DayEval; summary: Summary; onLock: () => void }) {
  const now = useNow();
  const events = useApp((s) => s.events);
  const birthdays = useApp((s) => s.birthdays);
  const settings = useApp((s) => s.settings);
  const spending = useApp((s) => s.spending);
  const todos = useApp((s) => s.todos);
  const list = suggestions(new Date(now), date, evaluation, summary, { events, birthdays, settings, spending, todos });
  if (!list.length) return null;

  const run = (s: Suggestion, e: MouseEvent) => {
    const a = s.action;
    if (!a) return;
    if (a.kind === 'tick') tickAll(date, summary.habits.filter((h) => a.habitIds.includes(h.id)), e);
    if (a.kind === 'water') addWater(date);
    if (a.kind === 'lock') onLock();
    if (a.kind === 'chest') useUi.setState({ chestDate: date });
    if (a.kind === 'scroll') scrollToAndFlash(a.target);
    if (a.kind === 'workout') logWorkout(date, a.workout, e);
    if (a.kind === 'card') useUi.setState({ cardOpen: true });
    if (a.kind === 'wrap') useUi.setState({ wrapDate: date });
  };

  return (
    <Card p="sm" px="md">
      <PanelHead
        title={
          <>
            <span style={{ color: 'var(--mantine-color-yellow-5)' }}>⚡</span> Up next
          </>
        }
        right={
          <Text size="xs" c="dimmed" fw={700} className="num">
            {dayjs(now).format('HH:mm')}
          </Text>
        }
      />
      <div style={{ marginTop: 2 }}>
        {list.map((s) => (
          <div key={s.id} className="hrow" style={accent(TONE[s.tone])}>
            <div className="hrow-main">
              <Tile emoji={s.emoji} color={TONE[s.tone]} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text fw={750} size="sm" lh={1.3}>
                  {s.title}
                </Text>
                {s.detail && (
                  <Text size="xs" c="dimmed" fw={550} lineClamp={2} mt={1}>
                    {s.detail}
                  </Text>
                )}
              </div>
              {s.action && (
                <Tap onClick={(e) => run(s, e)} className="chip" style={{ color: 'var(--accent-text)', background: 'var(--accent-soft)', fontWeight: 800 }}>
                  {s.action.label}
                </Tap>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
