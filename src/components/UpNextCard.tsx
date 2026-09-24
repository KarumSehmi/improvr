import { Button, Card, Group, Text } from '@mantine/core';
import dayjs from 'dayjs';
import type { MouseEvent } from 'react';
import { addWater, scrollToAndFlash, tickAll } from '../lib/actions';
import type { DateKey } from '../lib/dates';
import type { DayEval, Summary } from '../lib/engine';
import { useNow } from '../lib/hooks';
import { suggestions, type Suggestion } from '../lib/smart';
import { useApp } from '../lib/store';
import { Tap, Tile } from './ui';

const TONE = { info: 'violet', warn: 'orange', good: 'teal' } as const;

export default function UpNextCard({ date, evaluation, summary, onLock }: { date: DateKey; evaluation: DayEval; summary: Summary; onLock: () => void }) {
  const now = useNow();
  const events = useApp((s) => s.events);
  const birthdays = useApp((s) => s.birthdays);
  const settings = useApp((s) => s.settings);
  const list = suggestions(new Date(now), date, evaluation, summary, { events, birthdays, settings });
  if (!list.length) return null;

  const run = (s: Suggestion, e: MouseEvent) => {
    const a = s.action;
    if (!a) return;
    if (a.kind === 'tick') tickAll(date, summary.habits.filter((h) => a.habitIds.includes(h.id)), e);
    if (a.kind === 'water') addWater(date);
    if (a.kind === 'lock') onLock();
    if (a.kind === 'scroll') scrollToAndFlash(a.target);
  };

  return (
    <Card p="sm">
      <Group justify="space-between" px={4}>
        <Text fw={800} fz={17}>
          ⚡ Up next
        </Text>
        <Text size="xs" c="dimmed" fw={600}>
          {dayjs(now).format('HH:mm')}
        </Text>
      </Group>
      <div style={{ marginTop: 4 }}>
        {list.map((s) => (
          <div key={s.id} className="hrow">
            <div className="hrow-main">
              <Tile emoji={s.emoji} color={TONE[s.tone]} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text fw={700} size="sm" lh={1.3}>
                  {s.title}
                </Text>
                {s.detail && (
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {s.detail}
                  </Text>
                )}
              </div>
              {s.action && (
                <Tap onClick={(e) => run(s, e)}>
                  <Button component="div" size="compact-sm" variant="light" color={TONE[s.tone]}>
                    {s.action.label}
                  </Button>
                </Tap>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
