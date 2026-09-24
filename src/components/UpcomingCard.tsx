import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { birthdaysOn, eventsBetween, upcomingBirthdays } from '../lib/calendar';
import { CHORES } from '../lib/config';
import { addDays, diffDays, relativeDay, type DateKey } from '../lib/dates';
import type { Summary } from '../lib/engine';
import { updateDay, useApp } from '../lib/store';

/** Today's birthdays, shown at the top. */
export function BirthdayBanner({ today }: { today: DateKey }) {
  const birthdays = useApp((s) => s.birthdays);
  const list = birthdaysOn(birthdays, today);
  if (!list.length) return null;
  return (
    <Card p="sm" style={{ borderColor: 'var(--mantine-color-pink-outline)' }}>
      <Text fw={700}>🎂 It's {list.map((b) => b.name).join(' & ')}'s birthday today — send a message!</Text>
    </Card>
  );
}

export default function UpcomingCard({ today, summary }: { today: DateKey; summary: Summary }) {
  const events = useApp((s) => s.events);
  const birthdays = useApp((s) => s.birthdays);
  const todayEval = summary.evalByDate[today];

  const evs = eventsBetween(events, today, addDays(today, 7));
  const bdays = upcomingBirthdays(birthdays, today, 14).filter((b) => b.daysAway > 0);
  const doneToday = new Set(todayEval?.items.filter((i) => i.done || i.skipped).map((i) => i.habit.id));
  // Bigger jobs due in the next few days (daily room chores would just be noise here).
  const chores = CHORES.filter((h) => !(h.schedule && 'every' in h.schedule && h.schedule.every === 1) && !doneToday.has(h.id))
    .map((h) => ({ h, next: summary.tracks[h.id]?.nextDue ?? today }))
    .filter((c) => c.next > today && diffDays(c.next, today) <= 4)
    .sort((a, b) => a.next.localeCompare(b.next));

  if (!evs.length && !bdays.length && !chores.length) return null;

  return (
    <Card p="sm">
      <Text fw={800} px={4} mb="xs">
        🔭 Coming up
      </Text>
      <Stack gap={6}>
        {evs.map((e) => (
          <Group key={e.id} justify="space-between" wrap="nowrap" px={4}>
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <Badge color={e.color ?? 'violet'} variant="dot" size="lg" tt="none" style={{ flexShrink: 0 }}>
                {relativeDay(e.date, today)}
              </Badge>
              <Text size="sm" truncate>
                {e.title}
              </Text>
            </Group>
            {e.time && (
              <Text size="xs" c="dimmed">
                {e.time}
              </Text>
            )}
          </Group>
        ))}
        {bdays.map((b) => (
          <Group key={b.birthday.id} justify="space-between" wrap="nowrap" px={4}>
            <Text size="sm">
              🎂 {b.birthday.name}
              {b.turning ? ` turns ${b.turning}` : ''}
            </Text>
            <Text size="xs" c="dimmed">
              {relativeDay(b.date, today)}
            </Text>
          </Group>
        ))}
        {chores.map(({ h, next }) => (
          <Group key={h.id} justify="space-between" wrap="nowrap" px={4}>
            <Text size="sm">
              {h.emoji} {h.label}{' '}
              <Text span size="xs" c="dimmed">
                · {relativeDay(next, today)}
              </Text>
            </Text>
            <Button
              size="compact-xs"
              variant="light"
              onClick={() =>
                updateDay(today, (l) => {
                  l.done = { ...l.done, [h.id]: true };
                })
              }
            >
              Do early
            </Button>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
