import { Accordion, Alert, Anchor, Badge, Button, Card, Group, List, Select, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconBell, IconBellOff, IconCalendarPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { DEFAULT_REMINDERS } from '../lib/config';
import { useNow, useSummary } from '../lib/hooks';
import { DEFAULT_NOTIFY_MAX, NUDGES } from '../lib/nudges';
import { currentSubscription, pushEnvironment, subscribe } from '../lib/push';
import { buildReminders, downloadReminders } from '../lib/reminders';
import { updateSettings, useApp } from '../lib/store';
import type { ReminderSettings } from '../lib/types';
import { CopyField } from './ui';

/** Smart notifications (primary) plus the old Calendar alerts as a fallback. */
export default function RemindersCard() {
  const settings = useApp((s) => s.settings);
  const birthdays = useApp((s) => s.birthdays);
  const mode = useApp((s) => s.mode);
  const server = useApp((s) => s.server);
  const devices = useApp((s) => s.pushDevices);
  const summary = useSummary();
  const now = useNow();
  const r = { ...DEFAULT_REMINDERS, ...settings.reminders };
  const set = (patch: Partial<ReminderSettings>) => updateSettings({ reminders: { ...r, ...patch } });
  const env = pushEnvironment();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [timerUrl, setTimerUrl] = useState<string | null>(null);

  useEffect(() => {
    void currentSubscription().then((s) => setSubscribed(!!s));
  }, [devices]);

  // The cron-job.org timer runs every 5 minutes; GitHub's backup timer can go hours without running.
  const timerOk = !!server?.lastCron && now - server.lastCron < 30 * 60 * 1000;

  async function showTimer() {
    const cloud = await import('../lib/cloud');
    setTimerUrl(`${window.location.origin}/api/notify?key=${await cloud.shortcutKey()}`);
  }

  async function turnOn() {
    // Must be the very first thing: iPhone only shows the prompt if it's asked for straight from the tap.
    const permission = Notification.requestPermission();
    setBusy(true);
    try {
      if ((await permission) !== 'granted') throw new Error(Notification.permission === 'denied' ? 'blocked' : 'dismissed');
      const cloud = await import('../lib/cloud');
      const keys = await cloud.ensurePrivate();
      const sub = await subscribe(keys.vapidPublic);
      await cloud.savePushSubscription(sub.toJSON());
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Improvr', { body: "Notifications are on ✅ You'll only hear from me when something needs doing.", icon: '/pwa-192x192.png' });
      setSubscribed(true);
    } catch (e) {
      const msg = (e as Error).message;
      notifications.show({
        color: 'red',
        title: "Couldn't turn on notifications",
        message: msg === 'blocked' ? 'They are blocked. iPhone: Settings → Notifications → Improvr → Allow.' : msg === 'dismissed' ? 'You closed the prompt — tap again.' : msg,
      });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    const sub = await currentSubscription();
    if (sub) {
      const cloud = await import('../lib/cloud');
      await cloud.removePushSubscription(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }

  const addToCalendar = () => {
    try {
      downloadReminders(buildReminders(settings, summary, birthdays));
      notifications.show({ color: 'teal', title: 'Reminders ready', message: 'On iPhone, tap "Add All" to put them in your Calendar.' });
    } catch (e) {
      notifications.show({ color: 'red', title: "Couldn't make reminders", message: (e as Error).message });
    }
  };

  const whenLabel = (when: string) => (when in r ? (r[when as keyof ReminderSettings] as string) : when);
  const time = (key: keyof ReminderSettings, label: string) => (
    <TimeInput label={label} size="sm" value={r[key] as string} onChange={(e) => e.currentTarget.value && set({ [key]: e.currentTarget.value })} />
  );

  return (
    <Card>
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={800} fz={17}>
            🔔 Notifications
          </Text>
          <Text size="xs" c="dimmed">
            When something needs doing, plus your afternoon and evening check-ins (+5 XP each). The app icon shows how many things are due.
          </Text>
        </div>
        {subscribed && (
          <Badge color="teal" variant="light">
            On
          </Badge>
        )}
      </Group>

      <Stack gap="xs" mt="md">
        {mode !== 'cloud' ? (
          <Alert color="gray" variant="light" p="xs">
            Needs sync switched on (Firebase) — you're in local mode.
          </Alert>
        ) : env === 'needs-install' ? (
          <Alert color="violet" variant="light" p="xs" title="Add to Home Screen first">
            iPhone only allows notifications from web apps on your Home Screen. Safari → Share → Add to Home Screen, then open Improvr from there and come back here.
          </Alert>
        ) : env === 'unsupported' ? (
          <Alert color="gray" variant="light" p="xs">
            This browser can't do notifications. Use the Calendar alerts below instead.
          </Alert>
        ) : subscribed ? (
          <Button variant="light" color="gray" leftSection={<IconBellOff size={16} />} onClick={turnOff}>
            Turn off on this device
          </Button>
        ) : (
          <Button variant="gradient" size="md" leftSection={<IconBell size={18} />} loading={busy} onClick={turnOn}>
            Turn on notifications
          </Button>
        )}

        {mode === 'cloud' &&
          (timerOk ? (
            <Text size="xs" c="teal.4" fw={600}>
              ✓ Timer running · last check {dayjs(server!.lastCron).format('HH:mm')} · {devices} device{devices === 1 ? '' : 's'}
            </Text>
          ) : (
            <Alert color="orange" variant="light" p="sm" title={server?.lastCron ? `Timer hasn't run since ${dayjs(server.lastCron).format('ddd HH:mm')}` : 'One more step: give it a timer'}>
              <Text size="xs">
                {server?.lastCron
                  ? 'Check the job on cron-job.org is still switched on (it pauses a job after lots of failures).'
                  : "GitHub's free timer only runs every few hours, so notifications come late or not at all. A free timer on cron-job.org fixes it — 2 minutes, once."}
              </Text>
              {!timerUrl ? (
                <Button mt="sm" size="xs" variant="light" color="orange" onClick={() => void showTimer()}>
                  Set up the timer
                </Button>
              ) : (
                <Stack gap="xs" mt="sm">
                  <CopyField label="Your timer link (keep it private)" value={timerUrl} />
                  <List type="ordered" size="xs" spacing={4}>
                    <List.Item>
                      Go to{' '}
                      <Anchor href="https://cron-job.org" target="_blank" fz="xs">
                        cron-job.org
                      </Anchor>{' '}
                      and sign up (free).
                    </List.Item>
                    <List.Item>
                      <b>Create cronjob</b> → paste the link into <i>URL</i> → set <i>Execution schedule</i> to <b>every 5 minutes</b> → <b>Create</b>.
                    </List.Item>
                    <List.Item>That's it — this turns green within 5 minutes.</List.Item>
                  </List>
                </Stack>
              )}
            </Alert>
          ))}
      </Stack>

      <Group justify="space-between" wrap="nowrap" mt="md" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={600}>
            Reminders a day
          </Text>
          <Text size="xs" c="dimmed">
            Fine & lock-in warnings always come through. Opening the app clears them, and a new one replaces the last.
          </Text>
        </div>
        <Select
          w={112}
          size="xs"
          data={[
            { value: '2', label: 'At most 2' },
            { value: '3', label: 'At most 3' },
            { value: '4', label: 'At most 4' },
            { value: '6', label: 'At most 6' },
            { value: '0', label: 'No limit' },
          ]}
          value={String(settings.notifyMax ?? DEFAULT_NOTIFY_MAX)}
          onChange={(v) => v != null && updateSettings({ notifyMax: Number(v) })}
          allowDeselect={false}
          aria-label="Most reminders a day"
        />
      </Group>

      <Stack gap={6} mt="md">
        {NUDGES.map((n) => (
          <Group key={n.id} justify="space-between" wrap="nowrap">
            <div>
              <Text size="sm" fw={600}>
                {n.label}
              </Text>
              <Text size="xs" c="dimmed">
                {whenLabel(n.when)}
              </Text>
            </div>
            <Switch
              color="teal"
              checked={settings.notify?.[n.id] !== false}
              onChange={(e) => updateSettings({ notify: { ...settings.notify, [n.id]: e.currentTarget.checked } })}
              aria-label={n.label}
            />
          </Group>
        ))}
      </Stack>

      <SimpleGrid cols={2} spacing="sm" mt="md">
        {time('morning', 'Morning check-in')}
        {time('caffeine', 'Caffeine warning')}
        {time('lockIn', 'Lock-in reminder')}
        {time('bedtime', 'Bedtime')}
      </SimpleGrid>

      <Accordion variant="contained" mt="md" radius="lg">
        <Accordion.Item value="calendar">
          <Accordion.Control>
            <Text size="sm" fw={600}>
              📅 Prefer Calendar alerts instead?
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="xs" c="dimmed">
              Adds repeating events with alerts to your Calendar app. They fire every day whether or not you've done things, so smart
              notifications are better if you can use them.
            </Text>
            <Stack gap="xs" mt="sm">
              <Switch label="Weekly jobs + Sunday review" checked={r.weeklyJobs} onChange={(e) => set({ weeklyJobs: e.currentTarget.checked })} color="teal" />
              <Switch label="Friends' birthdays" checked={r.birthdays} onChange={(e) => set({ birthdays: e.currentTarget.checked })} color="teal" />
            </Stack>
            <Button mt="sm" fullWidth variant="light" leftSection={<IconCalendarPlus size={18} />} onClick={addToCalendar}>
              Add reminders to my Calendar
            </Button>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
}
