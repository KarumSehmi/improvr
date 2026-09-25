import { Badge, Button, Card, Group, NumberInput, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { budgetMessage, budgetStatus, money, pastMonths } from '../lib/budget';
import { BONUS } from '../lib/config';
import { pop } from '../lib/celebrate';
import { addDays, diffDays, fmt, type DateKey } from '../lib/dates';
import { floatXp } from '../lib/feedback';
import { upsert, useApp } from '../lib/store';

const COLOR = { 'no-data': 'gray', 'on-track': 'teal', 'over-pace': 'orange', 'over-limit': 'red' } as const;

/** Credit card this month: update it once a week and it tells you how you're doing. */
export default function BudgetCard({ today }: { today: DateKey }) {
  const spending = useApp((s) => s.spending);
  const settings = useApp((s) => s.settings);
  const b = budgetStatus(spending, settings, today);
  const months = pastMonths(spending, settings, today);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string | number>('');
  const open = editing || b.needsUpdate;
  const daysLeft = diffDays(b.end, today);

  const save = () => {
    const spent = Number(value);
    if (value === '' || !(spent >= 0)) return;
    const first = !spending[today];
    upsert('spending', { id: today, date: today, spent, at: Date.now() });
    if (first) {
      pop();
      floatXp(undefined, `+${BONUS.budget}`);
    }
    setEditing(false);
    setValue('');
    const after = budgetStatus({ ...spending, [today]: { id: today, date: today, spent, at: Date.now() } }, settings, today);
    notifications.show({ color: COLOR[after.state], title: '💳 Card updated', message: budgetMessage(after) });
  };

  const fill = Math.min(100, (b.spent / b.limit) * 100);
  const pacePct = Math.min(100, (b.pace / b.limit) * 100);

  return (
    <Card id="budget" p="sm" style={b.state === 'over-limit' ? { borderColor: 'var(--mantine-color-red-outline)' } : undefined}>
      <Group justify="space-between" wrap="nowrap" px={4}>
        <div style={{ minWidth: 0 }}>
          <Text fw={800} fz={17}>
            💳 Card spending
          </Text>
          <Text size="xs" c="dimmed">
            {fmt(b.start, 'D MMM')} – {fmt(b.end, 'D MMM')} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left · limit {money(b.limit)}
          </Text>
        </div>
        {b.needsUpdate ? (
          <Badge color="violet" variant="light" style={{ flexShrink: 0 }}>
            Update due
          </Badge>
        ) : (
          !editing && (
            <Button size="compact-sm" variant="light" onClick={() => setEditing(true)}>
              Update
            </Button>
          )
        )}
      </Group>

      <Stack gap={8} mt="sm" px={4}>
        {b.asOf && (
          <Group gap={6} align="baseline">
            <Text fw={900} fz={28} lh={1} c={`${COLOR[b.state]}.4`}>
              {money(b.spent)}
            </Text>
            <Text size="sm" c="dimmed">
              of {money(b.limit)}
            </Text>
          </Group>
        )}
        <div className="budget-bar" aria-label={`${money(b.spent)} of ${money(b.limit)}`}>
          <div className="budget-fill" data-state={b.state} style={{ width: `${fill}%` }} />
          {b.asOf && <div className="budget-pace" style={{ left: `${pacePct}%` }} />}
        </div>
        {b.asOf && (
          <Text size="xs" c="dimmed">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--mantine-color-yellow-4)', marginRight: 6 }} />
            Pace by {fmt(b.asOf, 'D MMM')}: {money(b.pace)}
            {b.daysLeft > 0 && b.spent > 0 && ` · at this rate ${money(b.projected)} by ${fmt(b.end, 'D MMM')}`}
          </Text>
        )}
        <Text size="sm" fw={600}>
          {budgetMessage(b)}
        </Text>

        {open ? (
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <NumberInput
              style={{ flex: 1 }}
              label="Spent on the card so far this month"
              description="The total from your banking app"
              prefix="£"
              min={0}
              decimalScale={2}
              thousandSeparator=","
              inputMode="decimal"
              placeholder={b.asOf ? money(b.spent) : '£0'}
              value={value}
              onChange={setValue}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <Button onClick={save} disabled={value === ''}>
              Save
            </Button>
          </Group>
        ) : null}

        <Text size="xs" c="dimmed">
          {b.asOf
            ? `Updated ${fmt(b.asOf, 'ddd D MMM')}${b.needsUpdate ? '' : ` · next update ${fmt(addDays(b.asOf, 7), 'ddd D MMM')}`} · +${BONUS.budget} XP each time`
            : `Update it once a week · +${BONUS.budget} XP each time`}
        </Text>
        {months.length > 0 && (
          <Group gap={6}>
            {months.map((m) => (
              <Badge key={m.start} variant="light" color={m.spent <= b.limit ? 'teal' : 'red'} tt="none">
                {fmt(m.start, 'MMM')}: {money(m.spent)} {m.spent <= b.limit ? '✓' : '✕'}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
