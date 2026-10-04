import { ActionIcon, Button, Card, Group, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { fireworks } from '../lib/celebrate';
import { fmt } from '../lib/dates';
import { useSummary } from '../lib/hooks';
import { newId, removeItem, upsert, useApp } from '../lib/store';
import { PanelHead } from './ui';

/** What you owe for days not locked in on time, paying it off, and the history. */
export default function FinesCard() {
  const summary = useSummary();
  const settings = useApp((s) => s.settings);
  const payments = useApp((s) => s.payments);
  const [amount, setAmount] = useState<number | string>('');
  const history = Object.values(payments).sort((a, b) => b.paidAt - a.paidAt);

  const pay = () => {
    const value = Number(amount || summary.owed);
    if (!value) return;
    upsert('payments', { id: newId(), amount: value, paidAt: Date.now() });
    setAmount('');
    if (value >= summary.owed) fireworks();
    notifications.show({ color: 'teal', title: 'Debt cleared 🙌', message: `£${value} to ${settings.charity}. Now don't miss another day.` });
  };

  return (
    <Card p="md" style={summary.owed ? { borderColor: 'color-mix(in srgb, var(--mantine-color-red-6) 45%, transparent)' } : undefined}>
      <PanelHead
        emoji="💷"
        color={summary.owed ? 'red' : 'teal'}
        title="Charity fines"
        sub={`£${settings.fineAmount} for every day not locked in on time`}
        right={
          <Text fw={900} fz={18} c={summary.owed ? 'var(--bad)' : 'var(--good)'} className="num">
            {summary.owed ? `£${summary.owed} owed` : 'All clear'}
          </Text>
        }
      />

      {summary.owed > 0 && (
        <Stack gap="xs" mt="md">
          <Text size="sm">
            Donate <b>£{summary.owed}</b> to <b>{settings.charity}</b>, then log it here.
          </Text>
          <Text size="xs" c="dimmed">
            Missed: {summary.fineDays.slice(-10).map((d) => fmt(d, 'ddd D MMM')).join(', ')}
            {summary.fineDays.length > 10 && ` and ${summary.fineDays.length - 10} more`}
          </Text>
          {settings.donateUrl && (
            <Button component="a" href={settings.donateUrl} target="_blank" rel="noreferrer" color="red" variant="light">
              Donate £{summary.owed} now
            </Button>
          )}
          <Group align="flex-end" wrap="nowrap">
            <NumberInput label="Amount donated" prefix="£" placeholder={`£${summary.owed}`} min={0} value={amount} onChange={setAmount} style={{ flex: 1 }} inputMode="decimal" />
            <Button color="teal" onClick={pay}>
              I've paid
            </Button>
          </Group>
        </Stack>
      )}

      <SimpleGrid cols={3} spacing="xs" mt="md">
        {[
          [`£${summary.fineTotal}`, 'fined in total'],
          [`£${summary.paid}`, 'donated'],
          [summary.fineDays.length, 'days missed'],
        ].map(([v, l]) => (
          <div key={l} style={{ background: 'var(--raised)', borderRadius: 14, padding: '10px 12px' }}>
            <Text fw={900} fz={18} className="num">
              {v}
            </Text>
            <Text size="xs" c="dimmed" fw={600}>
              {l}
            </Text>
          </div>
        ))}
      </SimpleGrid>

      {history.length > 0 && (
        <Stack gap={2} mt="md">
          <div className="eyebrow">Payments</div>
          {history.slice(0, 8).map((p) => (
            <Group key={p.id} justify="space-between">
              <Text size="sm" fw={600}>
                £{p.amount} · {dayjs(p.paidAt).format('D MMM YYYY')}
              </Text>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Remove payment"
                onClick={() =>
                  modals.openConfirmModal({
                    title: 'Remove this payment?',
                    labels: { confirm: 'Remove', cancel: 'Cancel' },
                    confirmProps: { color: 'red' },
                    onConfirm: () => removeItem('payments', p.id),
                  })
                }
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}
