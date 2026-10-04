import { Card, Group, Text } from '@mantine/core';
import { toggleWorkout } from '../lib/actions';
import { WORKOUTS } from '../lib/config';
import { addDays, weekday, weekStart, type DateKey } from '../lib/dates';
import type { Streak } from '../lib/engine';
import { useApp } from '../lib/store';
import { Bar, PanelHead, Tap, accent } from './ui';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Gym sessions this week against your target. Football and home workouts are extra. */
export default function TrainingCard({ date, streak }: { date: DateKey; streak: Streak }) {
  const days = useApp((s) => s.days);
  const target = useApp((s) => s.settings.workoutTarget);
  const workouts = days[date]?.workouts ?? [];
  const ws = weekStart(date);
  const week = LETTERS.map((_, i) => addDays(ws, i));
  // Only the gym counts towards the target; football is extra.
  const sessions = week.filter((d) => days[d]?.workouts?.includes('gym')).length;
  const hit = sessions >= target;
  const left = target - sessions;

  return (
    <Card id="training" p="sm" px="md" style={{ ...accent(hit ? 'teal' : 'lime'), scrollMarginTop: 90 }}>
      <PanelHead
        emoji={hit ? '💪' : '🏋️'}
        color={hit ? 'teal' : 'lime'}
        title="Training"
        sub={hit ? 'Gym target smashed this week' : `${left} more gym session${left === 1 ? '' : 's'} this week`}
        right={
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Text fz={13} fw={850} className="num" c={hit ? 'var(--good)' : 'dimmed'}>
              {sessions}/{target}
            </Text>
            {streak.current >= 1 && (
              <Text fz={11.5} fw={800} c="var(--mantine-color-orange-4)">
                <span className="flame">🔥</span> {streak.current} wk
              </Text>
            )}
          </div>
        }
      />
      <div style={{ margin: '10px 0 4px' }}>
        <Bar value={Math.min(100, (sessions / Math.max(1, target)) * 100)} color={hit ? 'teal' : 'lime'} h={4} />
      </div>

      <Group gap={8} mt={12} wrap="wrap">
        {WORKOUTS.filter((w) => !w.legacy || workouts.includes(w.id)).map((w) => {
          const on = workouts.includes(w.id);
          return (
            <Tap key={w.id} className="chip" data-active={on || undefined} onClick={(e) => toggleWorkout(date, w.id, e)} aria-pressed={on}>
              <span style={{ fontSize: 16 }}>{on ? '✓' : w.emoji}</span>
              {w.label}
              <Text span fz={11.5} fw={700} c="dimmed">
                +{w.points}
              </Text>
            </Tap>
          );
        })}
      </Group>

      <Group gap={4} mt={14} mb={4} justify="space-between" wrap="nowrap">
        {week.map((d, i) => {
          const gym = !!days[d]?.workouts?.includes('gym');
          const extra = gym ? undefined : WORKOUTS.find((w) => days[d]?.workouts?.includes(w.id))?.emoji;
          return (
            <div key={d} style={{ flex: 1, display: 'grid', justifyItems: 'center', gap: 4 }}>
              <Text fz={10.5} c={d === date ? undefined : 'dimmed'} fw={d === date ? 900 : 700}>
                {LETTERS[i]}
              </Text>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: 900,
                  color: 'white',
                  background: gym ? 'linear-gradient(140deg, var(--mantine-color-lime-5), var(--mantine-color-green-6))' : 'var(--ring-track)',
                  outline: d === date ? '2px solid var(--line-strong)' : undefined,
                  outlineOffset: 2,
                }}
              >
                {gym ? '✓' : (extra ?? '')}
              </div>
            </div>
          );
        })}
      </Group>

      {weekday(date) === 1 && (
        <Text size="xs" c="dimmed" mt="sm">
          ⚽ Football Monday — an optional extra. It earns XP but doesn't count towards your gym sessions.
        </Text>
      )}
    </Card>
  );
}
