import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  List,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconTrash, IconUpload } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { fireworks, pop } from '../lib/celebrate';
import HabitsEditor from '../components/HabitsEditor';
import RemindersCard from '../components/RemindersCard';
import SleepSyncCard from '../components/SleepSyncCard';
import { setFrequency } from '../lib/actions';
import { budgetSettings } from '../lib/budget';
import { BUILT_IN_BY_ID, FREQUENCY_OPTIONS, SLEEP_TARGETS } from '../lib/config';
import { everyOn } from '../lib/engine';
import { dateKey, fmt, weekday } from '../lib/dates';
import { useSummary } from '../lib/hooks';
import { getData, importData, newId, removeItem, updateSettings, upsert, useApp } from '../lib/store';
import type { AppData } from '../lib/types';

function FinesCard() {
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
    <Card style={summary.owed ? { borderColor: 'var(--mantine-color-red-outline)' } : undefined}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={800}>💷 Charity fines</Text>
          <Text size="xs" c="dimmed">
            £{settings.fineAmount} for every day you don't log in time
          </Text>
        </div>
        <Badge size="xl" color={summary.owed ? 'red' : 'teal'} variant="light">
          {summary.owed ? `£${summary.owed} owed` : 'All clear'}
        </Badge>
      </Group>

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
            <NumberInput
              label="Amount donated"
              prefix="£"
              placeholder={`£${summary.owed}`}
              min={0}
              value={amount}
              onChange={setAmount}
              style={{ flex: 1 }}
              inputMode="decimal"
            />
            <Button color="teal" onClick={pay}>
              I've paid
            </Button>
          </Group>
        </Stack>
      )}

      <Group mt="md" gap="lg">
        <div>
          <Text fw={800}>£{summary.fineTotal}</Text>
          <Text size="xs" c="dimmed">
            total fined
          </Text>
        </div>
        <div>
          <Text fw={800}>£{summary.paid}</Text>
          <Text size="xs" c="dimmed">
            donated
          </Text>
        </div>
        <div>
          <Text fw={800}>{summary.fineDays.length}</Text>
          <Text size="xs" c="dimmed">
            days missed
          </Text>
        </div>
      </Group>

      {history.length > 0 && (
        <Stack gap={4} mt="md">
          {history.slice(0, 8).map((p) => (
            <Group key={p.id} justify="space-between">
              <Text size="sm">
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

function RulesCard() {
  const fine = useApp((s) => `£${s.settings.fineAmount}`);
  const target = useApp((s) => s.settings.workoutTarget);
  return (
    <Card p={0}>
      <Accordion variant="default" chevronPosition="right">
        <Accordion.Item value="rules" style={{ borderBottom: 0 }}>
          <Accordion.Control>
            <Text fw={800}>📜 The rules</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <List spacing="xs" size="sm">
              <List.Item>
                <b>Log every day.</b> Tick things off as you go, then hit <i>Lock in</i>. You have until midnight at the end of the
                next day (24h after the day ends). Miss it and it's <b>{fine} to charity</b>. That's the only punishment.
              </List.Item>
              <List.Item>
                <b>One day off per week</b> (Mon–Sun). Streaks freeze, nothing counts against you and it counts as logged. Slips you log
                still count.
              </List.Item>
              <List.Item>
                <b>Tick everything → the day locks itself</b> and you get a perfect-day bonus. Locking in on time opens a{' '}
                <b>reward chest</b> (a perfect day's is golden).
              </List.Item>
              <List.Item>
                <b>Check in three times a day</b> — morning, afternoon, evening — for XP, with a bonus for all three. Plus one optional{' '}
                <b>bonus quest</b> a day.
              </List.Item>
              <List.Item>
                <b>Chores carry over.</b> Room stuff, bin, weekly cleans — if you don't do it, it's back tomorrow (in orange) until you do.
              </List.Item>
              <List.Item>
                <b>Training is weekly:</b> {target}+ sessions Mon–Sun. Gym gives the most XP, home workouts and football count too.
                Football Mondays are optional.
              </List.Item>
              <List.Item>
                <b>Weekends are more relaxed:</b> asleep by 2am on Friday and Saturday nights, up by 10:30 on Saturday and Sunday (change
                these in Settings).
              </List.Item>
              <List.Item>
                <b>Paula's Choice</b> can be skipped any time, no penalty.
              </List.Item>
              <List.Item>
                <b>Stayed clean</b> must be answered honestly before you lock in. Slips never cost money — they just reset the streak.
              </List.Item>
            </List>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
}

function SettingsCard() {
  const settings = useApp((s) => s.settings);
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const refill = BUILT_IN_BY_ID.pillRefill;

  return (
    <Card>
      <Text fw={800} mb="sm">
        ⚙️ Settings
      </Text>
      <Stack gap="sm">
        <TextInput label="Your name" defaultValue={settings.name} onBlur={(e) => updateSettings({ name: e.currentTarget.value.trim() })} />
        <TextInput
          label="Charity for fines"
          defaultValue={settings.charity}
          onBlur={(e) => updateSettings({ charity: e.currentTarget.value.trim() || 'a charity of your choice' })}
        />
        <TextInput
          label="Donation link"
          description="Makes paying a fine one tap"
          placeholder="https://…"
          defaultValue={settings.donateUrl ?? ''}
          onBlur={(e) => updateSettings({ donateUrl: e.currentTarget.value.trim() || undefined })}
        />
        <Group grow>
          <NumberInput label="Fine per missed day" prefix="£" min={1} value={settings.fineAmount} onChange={(v) => Number(v) > 0 && updateSettings({ fineAmount: Number(v) })} />
          <NumberInput label="Gym sessions / week" min={1} max={7} value={settings.workoutTarget} onChange={(v) => Number(v) > 0 && updateSettings({ workoutTarget: Number(v) })} />
        </Group>
        <Group grow>
          <NumberInput
            label="Finasteride target"
            suffix=" ml"
            min={0.1}
            step={0.1}
            decimalScale={2}
            value={settings.finTargetMl}
            onChange={(v) => Number(v) > 0 && updateSettings({ finTargetMl: Number(v) })}
          />
          <NumberInput
            label="Strength"
            suffix="%"
            min={0.001}
            step={0.005}
            decimalScale={3}
            value={settings.finConcentration}
            onChange={(v) => Number(v) > 0 && updateSettings({ finConcentration: Number(v) })}
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Card limit / month"
            description={`Stay well under £${budgetSettings(settings).ceiling.toLocaleString('en-GB')}`}
            prefix="£"
            min={50}
            step={50}
            thousandSeparator=","
            value={budgetSettings(settings).limit}
            onChange={(v) => Number(v) > 0 && updateSettings({ budget: { ...settings.budget, limit: Number(v) } })}
          />
          <NumberInput
            label="Card month starts"
            description="Day of the month"
            min={1}
            max={28}
            value={budgetSettings(settings).startDay}
            onChange={(v) => Number(v) >= 1 && updateSettings({ budget: { ...settings.budget, startDay: Math.min(28, Number(v)) } })}
          />
        </Group>
        <div>
          <Text size="sm" fw={500}>
            Weekends are more relaxed
          </Text>
          <Text size="xs" c="dimmed" mb={6}>
            Friday & Saturday nights and Saturday & Sunday mornings (weekdays stay 1am / 9am)
          </Text>
          <Group grow>
            <TimeInput
              label="Asleep before"
              value={settings.weekend?.sleep ?? SLEEP_TARGETS.weekend.sleep}
              onChange={(e) => e.currentTarget.value && updateSettings({ weekend: { ...settings.weekend, sleep: e.currentTarget.value } })}
            />
            <TimeInput
              label="Up before"
              value={settings.weekend?.wake ?? SLEEP_TARGETS.weekend.wake}
              onChange={(e) => e.currentTarget.value && updateSettings({ weekend: { ...settings.weekend, wake: e.currentTarget.value } })}
            />
          </Group>
        </div>
        <Select
          label="Apply finasteride"
          description="Only shows on Night when it's due, and carries over if you miss it. Changing it doesn't touch past days."
          data={FREQUENCY_OPTIONS}
          value={String(everyOn(settings, 'fin', dateKey()))}
          onChange={(v) => v && setFrequency('fin', Number(v))}
          allowDeselect={false}
        />
        <DatePickerInput
          label="Next pill organiser refill"
          description="Pick the Sunday you'll next refill — it repeats every 2 weeks from there"
          value={settings.anchors?.[refill.id] ?? null}
          excludeDate={(d) => weekday(d) !== 0}
          onChange={(d) => updateSettings({ anchors: { ...settings.anchors, [refill.id]: d ?? '' } })}
          clearable
        />
        <DatePickerInput
          label="Tracking start date"
          description="Nothing before this date counts (no fines, no streaks)"
          value={settings.startDate}
          maxDate={dateKey()}
          onChange={(d) => d && updateSettings({ startDate: d })}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Theme
          </Text>
          <SegmentedControl
            fullWidth
            value={colorScheme}
            onChange={(v) => setColorScheme(v as MantineColorScheme)}
            data={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'auto', label: 'Auto' },
            ]}
          />
        </div>
        <Switch
          color="teal"
          label="Sounds"
          description="A little pop when you tick things off. Your iPhone's silent switch mutes them."
          checked={settings.sounds !== false}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            updateSettings({ sounds: on });
            if (on) pop();
          }}
        />
      </Stack>
    </Card>
  );
}

function AccountCard() {
  const mode = useApp((s) => s.mode);
  const email = useApp((s) => s.email);
  const syncError = useApp((s) => s.syncError);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `improvr-backup-${dateKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File | null) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Partial<AppData>;
      modals.openConfirmModal({
        title: 'Import this backup?',
        children: (
          <Text size="sm">
            {Object.keys(data.days ?? {}).length} days, {Object.keys(data.events ?? {}).length} events and{' '}
            {Object.keys(data.birthdays ?? {}).length} birthdays will be merged into your current data.
          </Text>
        ),
        labels: { confirm: 'Import', cancel: 'Cancel' },
        onConfirm: () => {
          importData(data);
          notifications.show({ color: 'teal', title: 'Imported', message: 'Backup merged in.' });
        },
      });
    } catch {
      notifications.show({ color: 'red', title: "Couldn't read that file", message: 'Is it an Improvr backup?' });
    }
  };

  return (
    <Card>
      <Text fw={800} mb="xs">
        ☁️ Sync & backup
      </Text>
      {mode === 'cloud' ? (
        <Text size="sm">
          Syncing across your devices as <b>{email}</b>.
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          Local mode — data is saved on this device only. Add your Firebase config (see README) to sync your phone and computer.
        </Text>
      )}
      {syncError && (
        <Text size="xs" c="red" mt={4}>
          Sync error: {syncError}
        </Text>
      )}
      <Group mt="md" gap="xs">
        <Button variant="default" size="xs" leftSection={<IconDownload size={14} />} onClick={exportJson}>
          Export backup
        </Button>
        <FileButton onChange={(f) => void importJson(f)} accept="application/json">
          {(props) => (
            <Button {...props} variant="default" size="xs" leftSection={<IconUpload size={14} />}>
              Import backup
            </Button>
          )}
        </FileButton>
        {mode === 'cloud' && (
          <Button variant="subtle" color="red" size="xs" onClick={() => void import('../lib/cloud').then((m) => m.signOut())}>
            Sign out
          </Button>
        )}
      </Group>
    </Card>
  );
}

export default function MorePage() {
  return (
    <Stack>
      <Title order={2}>More</Title>
      <FinesCard />
      <RemindersCard />
      <SleepSyncCard />
      <HabitsEditor />
      <RulesCard />
      <SettingsCard />
      <AccountCard />
      <Text size="xs" c="dimmed" ta="center">
        Improvr · just try to be better than you were yesterday
      </Text>
    </Stack>
  );
}
