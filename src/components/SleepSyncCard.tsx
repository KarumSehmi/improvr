import { Button, Card, CopyButton, Group, List, Stack, Text, TextInput } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useApp } from '../lib/store';

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-end">
      <TextInput label={label} value={value} readOnly size="sm" style={{ flex: 1 }} onFocus={(e) => e.currentTarget.select()} />
      <CopyButton value={value}>
        {({ copied, copy }) => (
          <Button size="sm" variant="light" color={copied ? 'teal' : 'violet'} leftSection={<IconCopy size={14} />} onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </CopyButton>
    </Group>
  );
}

/** Set-up for the iPhone Shortcut that sends Apple Watch sleep times each morning. */
export default function SleepSyncCard() {
  const mode = useApp((s) => s.mode);
  const last = useApp((s) => s.server?.lastSleep);
  const [key, setKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const url = `${window.location.origin}/api/health`;

  async function reveal() {
    setOpen(true);
    const cloud = await import('../lib/cloud');
    setKey(await cloud.shortcutKey());
  }

  return (
    <Card>
      <Text fw={800} fz={17}>
        ⌚ Apple Watch sleep
      </Text>
      <Text size="xs" c="dimmed">
        Fills in "Asleep before 1am" and "Up before 9am" for you every morning, using an iPhone Shortcut. Anything you've already answered
        yourself is left alone.
      </Text>
      {last && (
        <Text size="xs" c="teal.4" fw={600} mt="xs">
          ✓ Last synced {dayjs(last.at).format('ddd HH:mm')}: asleep {last.asleep}, up {last.awake}
        </Text>
      )}

      {mode !== 'cloud' ? (
        <Text size="sm" c="dimmed" mt="sm">
          Needs sync switched on (Firebase).
        </Text>
      ) : !open ? (
        <Button mt="md" variant="light" fullWidth onClick={() => void reveal()}>
          Set it up
        </Button>
      ) : (
        <Stack gap="sm" mt="md">
          <CopyField label="URL" value={url} />
          <CopyField label="Your key (keep it private)" value={key ?? 'Loading…'} />
          <Text size="sm" fw={700}>
            In the Shortcuts app, make a new shortcut called "Improvr sleep":
          </Text>
          <List type="ordered" size="sm" spacing={6}>
            <List.Item>
              <b>Find Health Samples</b> → Type: <i>Sleep Analysis</i>, add a filter <i>Start Date is in the last 16 hours</i>, sort by{' '}
              <i>Start Date</i>, <i>Oldest First</i>.
            </List.Item>
            <List.Item>
              <b>Get Item from List</b> → <i>First Item</i> of Health Samples → <b>Get Details of Health Sample</b> → <i>Start Date</i> →{' '}
              <b>Format Date</b> → Custom: <code>HH:mm</code> → <b>Set Variable</b> <i>asleep</i>.
            </List.Item>
            <List.Item>
              <b>Get Item from List</b> → <i>Last Item</i> of Health Samples → <i>End Date</i> → <b>Format Date</b> <code>HH:mm</code> →{' '}
              <b>Set Variable</b> <i>awake</i>.
            </List.Item>
            <List.Item>
              <b>Get Contents of URL</b> → paste the URL, Method <i>POST</i>, Request Body <i>JSON</i> with three Text fields: <code>key</code>{' '}
              (paste your key), <code>asleep</code> and <code>awake</code> (the variables).
            </List.Item>
            <List.Item>
              <b>Automation</b> tab → + → <i>Alarm</i> → <i>Is Stopped</i> (or a time like 09:30) → <i>Run Immediately</i> → pick "Improvr
              sleep".
            </List.Item>
          </List>
          <Text size="xs" c="dimmed">
            Run the shortcut once by hand to test — it should say <code>"ok": true</code>. If it says the server isn't set up, add the
            FIREBASE_SERVICE_ACCOUNT variable in Vercel (README → Apple Watch sleep).
          </Text>
        </Stack>
      )}
    </Card>
  );
}
