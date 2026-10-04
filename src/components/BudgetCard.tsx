import { Badge, Button, Card, Group, NumberInput, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { budgetMessage, budgetStatus, money, pastMonths, type BudgetStatus } from '../lib/budget';
import { BONUS } from '../lib/config';
import { pop } from '../lib/celebrate';
import { addDays, diffDays, fmt, type DateKey } from '../lib/dates';
import { floatXp } from '../lib/feedback';
import { useToday, useUi } from '../lib/hooks';
import { savedBetween } from '../lib/personal';
import { upsert, useApp } from '../lib/store';
import { PanelHead, Sheet } from './ui';

const COLOR = { 'no-data': 'gray', 'on-track': 'teal', 'over-pace': 'orange', 'over-limit': 'red' } as const;

/** Save what you've spent on the card so far this month (+XP the first time each day). */
function saveSpend(spent: number, today: DateKey) {
  const { spending, settings } = useApp.getState();
  const first = !spending[today];
  const entry = { id: today, date: today, spent, at: Date.now() };
  upsert('spending', entry);
  if (first) {
    pop();
    floatXp(undefined, `+${BONUS.budget}`);
  }
  const after = budgetStatus({ ...spending, [today]: entry }, settings, today);
  notifications.show({ color: COLOR[after.state], title: '💳 Card updated', message: budgetMessage(after) });
}

/** The bar: spent against the limit, with a marker for where you'd be if you spread it evenly. */
function SpendBar({ b }: { b: BudgetStatus }) {
  const fill = Math.min(100, (b.spent / b.limit) * 100);
  const pacePct = Math.min(100, (b.pace / b.limit) * 100);
  return (
    <div className="budget-bar" aria-label={`${money(b.spent)} of ${money(b.limit)}`}>
      <div className="budget-fill" data-state={b.state} style={{ width: `${fill}%` }} />
      {b.asOf && <div className="budget-pace" style={{ left: `${pacePct}%` }} />}
    </div>
  );
}

/** Credit card this month: update it once a week and it tells you how you're doing. */
export default function BudgetCard({ today }: { today: DateKey }) {
  const spending = useApp((s) => s.spending);
  const settings = useApp((s) => s.settings);
  const days = useApp((s) => s.days);
  const b = budgetStatus(spending, settings, today);
  const months = pastMonths(spending, settings, today);
  const daysLeft = diffDays(b.end, today);
  const kept = savedBetween(days, 'vape', b.start, today, settings.costPerWeek?.vape ?? 0);

  return (
    <Card id="budget" p="md" style={b.state === 'over-limit' ? { borderColor: 'color-mix(in srgb, var(--mantine-color-red-6) 45%, transparent)' } : undefined}>
      <PanelHead
        emoji="💳"
        color={COLOR[b.state]}
        title="Card spending"
        sub={`${fmt(b.start, 'D MMM')} – ${fmt(b.end, 'D MMM')} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left · limit ${money(b.limit)}`}
        right={
          <Button size="compact-sm" variant={b.needsUpdate ? 'gradient' : 'light'} onClick={() => useUi.setState({ cardOpen: true })}>
            {b.needsUpdate ? 'Update due' : 'Update'}
          </Button>
        }
      />

      <Stack gap={10} mt="md">
        {b.asOf && (
          <Group gap={6} align="baseline">
            <Text fw={900} fz={34} lh={1} c={`var(--mantine-color-${COLOR[b.state]}-${b.state === 'no-data' ? 5 : 4})`} className="num" lts={-1}>
              {money(b.spent)}
            </Text>
            <Text size="sm" c="dimmed" fw={650}>
              of {money(b.limit)}
            </Text>
          </Group>
        )}
        <SpendBar b={b} />
        {b.asOf && (
          <Text size="xs" c="dimmed" fw={600}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--mantine-color-yellow-4)', marginRight: 6 }} />
            Pace by {fmt(b.asOf, 'D MMM')}: {money(b.pace)}
            {b.daysLeft > 0 && b.spent > 0 && ` · at this rate ${money(b.projected)} by ${fmt(b.end, 'D MMM')}`}
          </Text>
        )}
        <Text size="sm" fw={650}>
          {budgetMessage(b)}
        </Text>
        {kept > 0 && (
          <Text size="xs" fw={750} c="var(--good)">
            🚭 Staying nicotine-free has kept {money(kept)} in your pocket this month
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {b.asOf
            ? `Updated ${fmt(b.asOf, 'ddd D MMM')}${b.needsUpdate ? '' : ` · next update ${fmt(addDays(b.asOf, 7), 'ddd D MMM')}`} · +${BONUS.budget} XP each time`
            : `Update it once a week · +${BONUS.budget} XP each time`}
        </Text>
        {months.length > 0 && (
          <Group gap={6}>
            {months.map((m) => (
              <Badge key={m.start} variant="light" color={m.spent <= b.limit ? 'teal' : 'red'} tt="none" size="lg">
                {fmt(m.start, 'MMM')}: {money(m.spent)} {m.spent <= b.limit ? '✓' : '✕'}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
    </Card>
  );
}

/** "What have you spent so far this month?" — opened from Up next, Quick log or the Money tab. */
export function CardSheet() {
  const opened = useUi((s) => s.cardOpen);
  const today = useToday();
  const spending = useApp((s) => s.spending);
  const settings = useApp((s) => s.settings);
  const [value, setValue] = useState<string | number>('');
  const b = budgetStatus(spending, settings, today);
  const close = () => {
    useUi.setState({ cardOpen: false });
    setValue('');
  };
  const save = () => {
    const spent = Number(value);
    if (value === '' || !(spent >= 0)) return;
    saveSpend(spent, today);
    close();
  };

  return (
    <Sheet opened={opened} onClose={close} title="💳 Card spending">
      <Stack gap="md">
        <div>
          <Group justify="space-between" mb={6}>
            <Text size="sm" fw={700}>
              {b.asOf ? `${money(b.spent)} of ${money(b.limit)}` : `Limit ${money(b.limit)}`}
            </Text>
            <Text size="xs" c="dimmed" fw={600}>
              {b.asOf ? `last updated ${fmt(b.asOf, 'ddd D MMM')}` : 'nothing yet this month'}
            </Text>
          </Group>
          <SpendBar b={b} />
        </div>
        <NumberInput
          label="Spent on the card so far this month"
          description="The total from your banking app"
          prefix="£"
          min={0}
          decimalScale={2}
          thousandSeparator=","
          inputMode="decimal"
          size="md"
          placeholder={b.asOf ? money(b.spent) : '£0'}
          value={value}
          onChange={setValue}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          data-autofocus
        />
        <Button size="md" variant="gradient" onClick={save} disabled={value === ''}>
          Save{spending[today] ? '' : ` · +${BONUS.budget} XP`}
        </Button>
        <Text size="xs" c="dimmed" ta="center">
          {budgetMessage(b)}
        </Text>
      </Stack>
    </Sheet>
  );
}
