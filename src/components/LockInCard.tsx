import { Alert, Button, Card, Group, List, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconBeach, IconLock } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { BONUS } from '../lib/config';
import { burst } from '../lib/celebrate';
import { fmt, formatCountdown, logDeadline, relativeDay, type DateKey } from '../lib/dates';
import { dayOffUsedInWeek, isOpen, type DayEval } from '../lib/engine';
import { useNow, useToday } from '../lib/hooks';
import { updateDay, useApp } from '../lib/store';

export default function LockInCard({ date, evaluation: e }: { date: DateKey; evaluation: DayEval }) {
  const now = useNow();
  const today = useToday();
  const settings = useApp((s) => s.settings);
  const open = isOpen(date, today);
  const deadline = logDeadline(date);
  const days = useApp((s) => s.days);
  const usedOn = dayOffUsedInWeek(days, date);
  const label = relativeDay(date, today).toLowerCase();
  const fine = `£${settings.fineAmount}`;

  function lock() {
    const doLock = () => {
      updateDay(date, (l) => {
        l.closedAt ??= Date.now();
      });
      burst();
      notifications.show({
        color: open ? 'teal' : 'orange',
        title: open ? 'Locked in ✅' : 'Logged (late)',
        message: open ? `+${BONUS.loggedOnTime} XP for logging on time` : `The ${fine} fine still applies for this day.`,
      });
    };

    const unanswered = e.items.filter((i) => i.habit.kind === 'avoid' && !i.done && !i.missed);
    if (unanswered.length && !e.dayOff) {
      notifications.show({
        color: 'orange',
        title: 'Be honest first',
        message: `Answer: ${unanswered.map((i) => i.habit.label).join(', ')}`,
      });
      document.getElementById('section-clean')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Things you answered "no" to (late night, slipped) are logged honestly — only nag about untouched items.
    const missing = e.items.filter((i) => i.required && !i.done && !i.missed);
    if (!missing.length || e.dayOff) return doLock();
    modals.openConfirmModal({
      title: `Lock in with ${missing.length} unticked?`,
      children: (
        <Stack gap="xs">
          <List size="sm" spacing={2}>
            {missing.map((i) => (
              <List.Item key={i.habit.id} icon={i.habit.emoji}>
                {i.habit.label}
              </List.Item>
            ))}
          </List>
          <Text size="xs" c="dimmed">
            That's fine — logging honestly is what matters. You can still tick things off until the deadline.
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Lock it in', cancel: 'Keep going' },
      onConfirm: doLock,
    });
  }

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
    <Button
      variant="subtle"
      color="blue"
      size="xs"
      leftSection={<IconBeach size={16} />}
      disabled={!!usedOn}
      onClick={takeDayOff}
    >
      {usedOn ? `Day off used (${fmt(usedOn, 'ddd')})` : 'Use day off (1/week)'}
    </Button>
  );

  if (e.dayOff) {
    return (
      <Card p="md" style={{ borderColor: 'var(--mantine-color-blue-outline)' }}>
        <Group justify="space-between">
          <div>
            <Text fw={800}>🏖️ Day off</Text>
            <Text size="xs" c="dimmed">
              Streaks frozen. Counts as logged. Back at it tomorrow.
            </Text>
          </div>
          {open && (
            <Button
              variant="default"
              size="xs"
              onClick={() =>
                updateDay(date, (l) => {
                  l.dayOff = false;
                })
              }
            >
              Undo
            </Button>
          )}
        </Group>
      </Card>
    );
  }

  if (e.closed) {
    return (
      <Card p="md" style={{ borderColor: `var(--mantine-color-${e.onTime ? 'teal' : 'red'}-outline)` }}>
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text fw={800}>{e.onTime ? `✅ Locked in ${label}` : '⚠️ Logged late'}</Text>
            <Text size="xs" c="dimmed">
              {e.onTime
                ? `at ${dayjs(e.log?.closedAt ?? 0).format('HH:mm ddd')} · you can still edit until ${dayjs(deadline).subtract(1, 'minute').format('ddd HH:mm')}`
                : `After the deadline — ${fine} to ${settings.charity} for this day.`}
            </Text>
          </div>
        </Group>
        {dayOffButton && <Group mt="xs">{dayOffButton}</Group>}
      </Card>
    );
  }

  return (
    <Card p="md" className="hero">
      <Stack gap="sm">
        {open ? (
          <div>
            <Text fw={800}>Lock in {label}</Text>
            <Text size="xs" c="dimmed">
              Deadline {dayjs(deadline).subtract(1, 'minute').format('ddd HH:mm')} · {formatCountdown(deadline - now)} left · miss it
              and it's {fine} to charity
            </Text>
          </div>
        ) : (
          <Alert color="red" variant="light" p="xs" title="Deadline missed">
            This day wasn't logged in time — {fine} to {settings.charity}. You can still fill it in for your history.
          </Alert>
        )}
        <Button size="md" variant="gradient" leftSection={<IconLock size={18} />} onClick={lock} fullWidth>
          {open ? `Lock in ${label}` : 'Log it anyway (fine stands)'}
        </Button>
        {dayOffButton && <Group justify="center">{dayOffButton}</Group>}
      </Stack>
    </Card>
  );
}
