import { Button, Card, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendarPlus } from '@tabler/icons-react';
import { DEFAULT_REMINDERS } from '../lib/config';
import { useSummary } from '../lib/hooks';
import { buildReminders, downloadReminders } from '../lib/reminders';
import { updateSettings, useApp } from '../lib/store';
import type { ReminderSettings } from '../lib/types';

export default function RemindersCard() {
  const settings = useApp((s) => s.settings);
  const birthdays = useApp((s) => s.birthdays);
  const summary = useSummary();
  const r = { ...DEFAULT_REMINDERS, ...settings.reminders };
  const set = (patch: Partial<ReminderSettings>) => updateSettings({ reminders: { ...r, ...patch } });

  const add = () => {
    try {
      downloadReminders(buildReminders(settings, summary, birthdays));
      notifications.show({ color: 'teal', title: 'Reminders ready', message: 'On iPhone, tap "Add All" to put them in your Calendar.' });
    } catch (e) {
      notifications.show({ color: 'red', title: "Couldn't make reminders", message: (e as Error).message });
    }
  };

  const time = (key: keyof ReminderSettings, label: string) => (
    <TimeInput label={label} size="sm" value={r[key] as string} onChange={(e) => e.currentTarget.value && set({ [key]: e.currentTarget.value })} />
  );

  return (
    <Card>
      <Text fw={800} fz={17}>
        🔔 Reminders
      </Text>
      <Text size="xs" c="dimmed">
        iPhone won't let a website send notifications by itself, so Improvr puts repeating reminders in your Calendar app instead. They
        buzz like normal notifications.
      </Text>
      <SimpleGrid cols={2} spacing="sm" mt="md">
        {time('morning', 'Morning check-in')}
        {time('caffeine', 'Caffeine warning')}
        {time('lockIn', 'Lock-in reminder')}
        {time('bedtime', 'Bedtime')}
      </SimpleGrid>
      <Stack gap="xs" mt="md">
        <Switch label="Weekly jobs + Sunday review" checked={r.weeklyJobs} onChange={(e) => set({ weeklyJobs: e.currentTarget.checked })} color="teal" />
        <Switch label="Friends' birthdays (evening before + morning of)" checked={r.birthdays} onChange={(e) => set({ birthdays: e.currentTarget.checked })} color="teal" />
      </Stack>
      <Button mt="md" fullWidth variant="gradient" leftSection={<IconCalendarPlus size={18} />} onClick={add}>
        Add reminders to my Calendar
      </Button>
      <Text size="xs" c="dimmed" mt="xs">
        Changed a time later? Delete the old Improvr events in Calendar, then add again.
      </Text>
    </Card>
  );
}
