import { Alert, Button, Card, CopyButton, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconLink, IconSend } from '@tabler/icons-react';
import { useState } from 'react';
import { buddyLink, buddyReport, buddySnapshot } from '../lib/buddy';
import { useSummary } from '../lib/hooks';
import { updateSettings, useApp } from '../lib/store';

const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Someone who can see how you're really doing — live link plus a weekly report. */
export default function BuddyCard() {
  const settings = useApp((s) => s.settings);
  const mode = useApp((s) => s.mode);
  const uid = useApp((s) => s.uid);
  const server = useApp((s) => s.server);
  const summary = useSummary();
  const buddy = settings.buddy;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  if (mode !== 'cloud') {
    return (
      <Card>
        <Text fw={800} fz={17}>
          🤝 Accountability buddy
        </Text>
        <Text size="sm" c="dimmed" mt={4}>
          Needs sync switched on (Firebase) so your buddy's link can show live progress.
        </Text>
      </Card>
    );
  }

  const link = buddy ? buddyLink(window.location.origin, buddy.token) : '';
  const report = () => buddyReport(buddySnapshot(summary, uid ?? ''), link);

  async function sendReport() {
    const text = report();
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text);
      notifications.show({ color: 'teal', title: 'Copied', message: 'Paste it into WhatsApp / iMessage.' });
    }
  }

  function stop() {
    if (!buddy) return;
    modals.openConfirmModal({
      title: 'Stop sharing with your buddy?',
      children: <Text size="sm">The link stops working straight away.</Text>,
      labels: { confirm: 'Stop sharing', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const cloud = await import('../lib/cloud');
        await cloud.deleteBuddy(buddy.token).catch(() => {});
        updateSettings({ buddy: null });
      },
    });
  }

  async function newLink() {
    if (!buddy) return;
    const cloud = await import('../lib/cloud');
    await cloud.deleteBuddy(buddy.token).catch(() => {});
    updateSettings({ buddy: { ...buddy, token: newToken() } });
    notifications.show({ color: 'teal', title: 'New link made', message: 'The old one no longer works — send them the new one.' });
  }

  if (!buddy) {
    return (
      <Card>
        <Text fw={800} fz={17}>
          🤝 Accountability buddy
        </Text>
        <Text size="xs" c="dimmed">
          A friend gets a private link showing your week: grade, streaks and any fines you owe. Harder to let things slide when someone's
          watching.
        </Text>
        <Stack gap="xs" mt="md">
          <TextInput label="Buddy's name" placeholder="Sam" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput
            label="Their email (optional)"
            description="For an automatic report every Sunday evening"
            placeholder="sam@…"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <Button
            variant="gradient"
            leftSection={<IconLink size={18} />}
            disabled={!name.trim()}
            onClick={() => updateSettings({ buddy: { name: name.trim(), email: email.trim() || undefined, token: newToken(), showSlips: true } })}
          >
            Create my buddy link
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card>
      <Text fw={800} fz={17}>
        🤝 {buddy.name} is your buddy
      </Text>
      <Text size="xs" c="dimmed">
        Their link always shows your latest numbers, even if you stop opening the app.
      </Text>

      <Group mt="md" gap="xs" wrap="nowrap">
        <TextInput value={link} readOnly style={{ flex: 1 }} size="sm" onFocus={(e) => e.currentTarget.select()} />
        <CopyButton value={link}>
          {({ copied, copy }) => (
            <Button size="sm" variant="light" color={copied ? 'teal' : 'violet'} leftSection={<IconCopy size={14} />} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </CopyButton>
      </Group>
      <Button mt="xs" fullWidth variant="gradient" leftSection={<IconSend size={16} />} onClick={() => void sendReport()}>
        Send {buddy.name} this week's report
      </Button>

      {buddy.email ? (
        <Text size="xs" c={server?.emailReady ? 'teal.4' : 'dimmed'} mt="xs" fw={600}>
          {server?.emailReady
            ? `✓ ${buddy.name} gets an email every Sunday evening${server.lastEmail ? '' : ' (first one this Sunday)'}.`
            : 'Automatic Sunday email needs Gmail set up on GitHub (README → Buddy email). Until then, use the button above.'}
        </Text>
      ) : null}

      <Stack gap="xs" mt="md">
        <TextInput label="Buddy's name" defaultValue={buddy.name} onBlur={(e) => e.currentTarget.value.trim() && updateSettings({ buddy: { ...buddy, name: e.currentTarget.value.trim() } })} />
        <TextInput
          label="Their email (optional)"
          type="email"
          defaultValue={buddy.email ?? ''}
          onBlur={(e) => updateSettings({ buddy: { ...buddy, email: e.currentTarget.value.trim() || undefined } })}
        />
        <Switch
          color="teal"
          label="Show my slips (vaping, porn, etc.)"
          description="Off = they see streaks and fines, not what you slipped on"
          checked={buddy.showSlips}
          onChange={(e) => updateSettings({ buddy: { ...buddy, showSlips: e.currentTarget.checked } })}
        />
      </Stack>
      {!server?.lastRun && (
        <Alert color="gray" variant="light" p="xs" mt="md">
          The link updates whenever you use the app. Once the notification server is running it also updates every 15 minutes on its own.
        </Alert>
      )}
      <Group mt="md" gap="xs">
        <Button size="xs" variant="subtle" onClick={() => void newLink()}>
          New link
        </Button>
        <Button size="xs" variant="subtle" color="red" onClick={stop}>
          Stop sharing
        </Button>
      </Group>
    </Card>
  );
}
