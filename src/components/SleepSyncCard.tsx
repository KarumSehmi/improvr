import { Button, Card, CopyButton, Group, List, Stack, Table, Text, TextInput } from '@mantine/core';
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
        Fills in "Asleep before 1am" and "Up before 9am" every morning with the actual times (and how long you slept), using an iPhone
        Shortcut. The Watch's times take over when it syncs; you can still change them by hand after.
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
            In the Shortcuts app, make a shortcut with just these two actions:
          </Text>
          <List type="ordered" size="sm" spacing={8}>
            <List.Item>
              <b>Find Health Samples</b> where <i>Type is Sleep</i> and <i>Start Date is in the last 1 day</i>. Leave everything else as it
              is.
            </List.Item>
            <List.Item>
              <b>Get Contents of URL</b>: paste the URL, tap the arrow to show more, set <i>Method</i> to <b>POST</b> and <i>Request Body</i>{' '}
              to <b>JSON</b>. Then add three <b>Text</b> fields:
              <Table withTableBorder withColumnBorders mt={6} fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Left box (Key)</Table.Th>
                    <Table.Th>Right box (Text)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>
                      <code>key</code>
                    </Table.Td>
                    <Table.Td>paste your key</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <code>asleep</code>
                    </Table.Td>
                    <Table.Td>
                      pick <i>Health Samples</i>, tap it, choose <b>Start Date</b>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <code>awake</code>
                    </Table.Td>
                    <Table.Td>
                      pick <i>Health Samples</i>, tap it, choose <b>End Date</b>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </List.Item>
            <List.Item>
              <b>Automation</b> tab → + → <i>Alarm</i> → <i>Is Stopped</i> (or a time like 09:30) → <i>Run Immediately</i> → pick your
              shortcut.
            </List.Item>
          </List>
          <Text size="xs" c="dimmed">
            No need for "Get Item from List" or "Format Date" — Improvr works out when you fell asleep and woke up from all the samples. Tap ▶
            to test: you should see <code>"ok": true</code>. If it says the server isn't set up, add FIREBASE_SERVICE_ACCOUNT in Vercel
            (README → Apple Watch sleep).
          </Text>
        </Stack>
      )}
    </Card>
  );
}
