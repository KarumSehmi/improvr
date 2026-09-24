import { Alert, Button, Card, Group, List, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconBeach, IconLock } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { fmt, formatCountdown, logDeadline, relativeDay, type DateKey } from '../lib/dates';
import { BONUS } from '../lib/config';
import { dayOffUsedInWeek, isOpen, type DayEval } from '../lib/engine';
import { useNow, useToday, useUi } from '../lib/hooks';
import { lockDay } from '../lib/lock';
import { chestReady, chestTier } from '../lib/moments';
import { updateDay, useApp } from '../lib/store';
import { Tap } from './ui';

/** `early`: before the evening it's a small card — locking in is for the end of the day. */
export default function LockInCard({ date, evaluation: e, early }: { date: DateKey; evaluation: DayEval; early?: boolean }) {
  const now = useNow();
  const today = useToday();
  const settings = useApp((s) => s.settings);
  const days = useApp((s) => s.days);
  const open = isOpen(date, today);
  const deadline = logDeadline(date);
  const usedOn = dayOffUsedInWeek(days, date);
  const label = relativeDay(date, today).toLowerCase();
  const fine = `£${settings.fineAmount}`;
  const deadlineText = dayjs(deadline).subtract(1, 'minute').format('ddd HH:mm');

  function takeDayOff() {
    modals.openConfirmModal({
      title: `Use your day off for ${label}?`,
      children: (
        <Stack gap={6}>
          <Text size="sm">You get one per week (Mon–Sun). On a day off:</Text>
          <List size="sm" spacing={2}>
            <List.Item>Streaks are frozen — nothing breaks, nothing counts against you</List.Item>
            <List.Item>It counts as logged, so no fine</List.Item>
            <List.Item>Chores just carry over to tomorrow</List.Item>
            <List.Item>Anything you do tick still earns XP (and slips still count)</List.Item>
          </List>
        </Stack>
      ),
      labels: { confirm: 'Take the day off', cancel: 'Cancel' },
      onConfirm: () =>
        updateDay(date, (l) => {
          l.dayOff = true;
          l.closedAt ??= Date.now();
        }),
    });
  }

  const dayOffButton = !e.dayOff && open && (
    <Button variant="subtle" color="blue" size="xs" leftSection={<IconBeach size={16} />} disabled={!!usedOn} onClick={takeDayOff}>
      {usedOn ? `Day off used (${fmt(usedOn, 'ddd')})` : 'Use day off (1/week)'}
    </Button>
  );

  if (e.dayOff) {
    return (
      <Card id="lock-card" p="md" style={{ borderColor: 'var(--mantine-color-blue-outline)' }}>
        <Group justify="space-between">
          <div>
            <Text fw={800}>🏖️ Day off</Text>
            <Text size="xs" c="dimmed">
              Streaks frozen. Counts as logged. Back at it tomorrow.
            </Text>
          </div>
          {open && (
            <Button variant="default" size="xs" onClick={() => updateDay(date, (l) => void (l.dayOff = false))}>
              Undo
            </Button>
          )}
        </Group>
      </Card>
    );
  }

  if (e.closed) {
    const chest = e.log?.chest;
    return (
      <Card id="lock-card" p="md" style={{ borderColor: `var(--mantine-color-${e.onTime ? 'teal' : 'red'}-outline)` }}>
        <Text fw={800}>{e.onTime ? `✅ Locked in ${label}` : '⚠️ Logged late'}</Text>
        <Text size="xs" c="dimmed">
          {e.onTime
            ? `at ${dayjs(e.log?.closedAt ?? 0).format('HH:mm ddd')} · you can still edit until ${deadlineText}`
            : `After the deadline — ${fine} to ${settings.charity} for this day.`}
        </Text>
        {chestReady(e, today) && (
          <Button mt="sm" fullWidth variant="gradient" gradient={e.perfect ? { from: 'yellow', to: 'orange' } : undefined} onClick={() => useUi.setState({ chestDate: date })}>
            🎁 Open your {e.perfect ? 'golden ' : ''}reward chest
          </Button>
        )}
        {chest != null && (
          <Text size="sm" fw={700} mt="xs">
            🎁 Chest: +{chest} XP ({chestTier(chest).label})
          </Text>
        )}
        {dayOffButton && <Group mt="xs">{dayOffButton}</Group>}
      </Card>
    );
  }

  if (open && early) {
    return (
      <Card id="lock-card" p="md">
        <Group justify="space-between" wrap="nowrap">
          <div style={{ minWidth: 0 }}>
            <Text fw={800}>🔒 Lock in tonight</Text>
            <Text size="xs" c="dimmed">
              +{BONUS.loggedOnTime} XP and a reward chest 🎁 · by {deadlineText}
            </Text>
          </div>
          <Tap onClick={() => lockDay(date, e, open)}>
            <Button component="div" size="compact-sm" variant="light">
              Lock in now
            </Button>
          </Tap>
        </Group>
        {dayOffButton && <Group mt="xs">{dayOffButton}</Group>}
      </Card>
    );
  }

  return (
    <Card id="lock-card" p="md" className="hero">
      <Stack gap="sm">
        {open ? (
          <div>
            <Text fw={800} fz={17}>
              Lock in {label}
            </Text>
            <Text size="xs" c="dimmed">
              On time = +{BONUS.loggedOnTime} XP and a reward chest 🎁 · deadline {deadlineText} ({formatCountdown(deadline - now)} left) · miss it and
              it's {fine} to charity
            </Text>
          </div>
        ) : (
          <Alert color="red" variant="light" p="xs" title="Deadline missed">
            This day wasn't logged in time — {fine} to {settings.charity}. You can still fill it in for your history.
          </Alert>
        )}
        <Tap onClick={() => lockDay(date, e, open)}>
          <Button component="div" size="lg" variant="gradient" leftSection={<IconLock size={18} />} fullWidth>
            {open ? `Lock in ${label}` : 'Log it anyway (fine stands)'}
          </Button>
        </Tap>
        {dayOffButton && <Group justify="center">{dayOffButton}</Group>}
      </Stack>
    </Card>
  );
}
