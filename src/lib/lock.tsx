import { List, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { burst } from './celebrate';
import { BONUS } from './config';
import type { DateKey } from './dates';
import type { DayEval } from './engine';
import { updateDay, useApp } from './store';

/** Lock a day in (checks the honesty questions first, and confirms if things are unticked). */
export function lockDay(date: DateKey, e: DayEval, open: boolean) {
  const fine = `£${useApp.getState().settings.fineAmount}`;
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

  const unanswered = e.items.filter((i) => i.visible && i.habit.kind === 'avoid' && !i.done && !i.missed);
  if (unanswered.length && !e.dayOff) {
    notifications.show({ color: 'orange', title: 'Be honest first', message: `Answer: ${unanswered.map((i) => i.habit.label).join(', ')}` });
    document.getElementById('section-clean')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Things you answered "no" to (late night, slipped) are logged honestly — only mention untouched items.
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

