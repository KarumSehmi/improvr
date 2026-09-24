import { Badge, Card, Center, Container, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import type { BuddySnapshot } from '../lib/buddy';
import { grade } from '../lib/engine';

/** What your buddy sees: read-only, no login. */
export default function BuddyPage({ token }: { token: string }) {
  const [data, setData] = useState<BuddySnapshot | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import('../lib/cloud')
      .then((m) => m.fetchBuddy(token))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  if (error || data === null) {
    return (
      <Center mih="100dvh" p="md">
        <Card maw={380} ta="center">
          <Text fz={40}>🔒</Text>
          <Text fw={800}>This link doesn't work any more</Text>
          <Text size="sm" c="dimmed">
            Ask for a new one.
          </Text>
        </Card>
      </Center>
    );
  }
  if (!data) {
    return (
      <Center h="100dvh">
        <Loader type="dots" />
      </Center>
    );
  }

  const g = grade(data.week.avgPct);
  return (
    <Container size={560} py="lg" px="md" className="safe-top">
      <Stack>
        <div>
          <div className="eyebrow">Accountability · updated {dayjs(data.updatedAt).format('ddd HH:mm')}</div>
          <Title order={1} fz={28}>
            How's {data.name} doing?
          </Title>
          <Text size="sm" c="dimmed" fs="italic">
            “Just try to be better than you were yesterday.”
          </Text>
        </div>

        {data.fines.owed > 0 && (
          <Card style={{ borderColor: 'var(--mantine-color-red-outline)' }}>
            <Text fw={800}>
              💷 Owes £{data.fines.owed} to {data.fines.charity}
            </Text>
            <Text size="sm" c="dimmed">
              £5 for every day not logged in time. Chase them for it.
            </Text>
          </Card>
        )}
        {data.unloggedYesterday && (
          <Card style={{ borderColor: 'var(--mantine-color-orange-outline)' }}>
            <Text fw={700}>⏳ Hasn't logged yesterday yet — deadline is midnight tonight.</Text>
          </Card>
        )}

        <Card className="hero" p="lg">
          <Group wrap="nowrap" gap="lg">
            <Text fz={64} fw={900} lh={1} c={`${g.color}.4`}>
              {g.letter === '😌' ? '–' : g.letter}
            </Text>
            <div>
              <Text fw={800}>This week</Text>
              <Text size="sm" c="dimmed">
                {data.week.avgPct != null ? `${data.week.avgPct}% of their list done on average` : 'Just getting started'}
              </Text>
              <Text size="sm" c="dimmed">
                Logged {data.week.logged}/{data.week.days} days · 🔥 {data.logStreak}-day streak
              </Text>
            </div>
          </Group>
        </Card>

        <SimpleGrid cols={2} spacing="sm">
          <Card p="sm">
            <Text fz={24} fw={900}>
              {data.week.sessions}/{data.week.target}
            </Text>
            <Text size="xs" fw={600}>
              🏋️ Gym sessions this week
            </Text>
          </Card>
          <Card p="sm">
            <Text fz={24} fw={900}>
              £{data.fines.paid}
            </Text>
            <Text size="xs" fw={600}>
              💷 Donated to charity so far
            </Text>
          </Card>
          {data.saved != null && (
            <Card p="sm">
              <Text fz={24} fw={900} c="teal.4">
                £{data.saved}
              </Text>
              <Text size="xs" fw={600}>
                💰 Saved by staying clean
              </Text>
            </Card>
          )}
        </SimpleGrid>

        <Card p="sm">
          <Text fw={800} px={4} mb="xs">
            🛡️ Staying clean
          </Text>
          <Stack gap={8}>
            {data.clean.map((c) => (
              <Group key={c.label} justify="space-between" px={4}>
                <Text size="sm" fw={600}>
                  {c.emoji} {c.label}
                </Text>
                <Group gap={6}>
                  <Badge variant="light" color="orange">
                    🔥 {c.streak}d
                  </Badge>
                  {c.slipsThisWeek != null && (
                    <Badge variant="light" color={c.slipsThisWeek ? 'red' : 'teal'}>
                      {c.slipsThisWeek} slip{c.slipsThisWeek === 1 ? '' : 's'}
                    </Badge>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        </Card>

        <Card p="sm">
          <Text fw={800} px={4} mb="xs">
            📆 Previous weeks
          </Text>
          <Group grow>
            {data.lastWeeks.map((w) => (
              <Stack key={w.start} gap={0} align="center">
                <Text fw={900} fz={22} c={`${grade(w.avgPct).color}.4`}>
                  {w.avgPct == null ? '–' : grade(w.avgPct).letter}
                </Text>
                <Text size="xs" c="dimmed">
                  {dayjs(w.start).format('D MMM')}
                </Text>
              </Stack>
            ))}
          </Group>
        </Card>

        <Text size="xs" c="dimmed" ta="center">
          Improvr · read-only link shared by {data.name}
        </Text>
      </Stack>
    </Container>
  );
}
