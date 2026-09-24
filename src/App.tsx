import { AppShell, Badge, Center, Container, Group, Loader, NavLink, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconCalendar, IconChecklist, IconChartBar, IconDots } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { goTo, useSummary, useUi, type Page } from './lib/hooks';
import { useApp } from './lib/store';
import CalendarPage from './pages/CalendarPage';
import LoginPage from './pages/LoginPage';
import MorePage from './pages/MorePage';
import ProgressPage from './pages/ProgressPage';
import TodayPage from './pages/TodayPage';

const TABS: { id: Page; label: string; icon: ComponentType<{ size?: number; stroke?: number }> }[] = [
  { id: 'today', label: 'Today', icon: IconChecklist },
  { id: 'calendar', label: 'Calendar', icon: IconCalendar },
  { id: 'progress', label: 'Progress', icon: IconChartBar },
  { id: 'more', label: 'More', icon: IconDots },
];

export default function App() {
  const status = useApp((s) => s.status);

  if (status === 'signedOut') return <LoginPage />;
  if (status === 'loading') {
    return (
      <Center h="100dvh">
        <Stack align="center" gap="xs">
          <Loader type="dots" />
          <Text c="dimmed" size="sm">
            Loading your streaks…
          </Text>
        </Stack>
      </Center>
    );
  }
  return <Shell />;
}

function Shell() {
  const page = useUi((s) => s.page);
  const summary = useSummary();
  const alerts = summary.owed > 0 || summary.openUnlogged.some((d) => d !== summary.today);

  return (
    <AppShell
      navbar={{ width: 230, breakpoint: 'sm', collapsed: { mobile: true } }}
      footer={{ height: { base: 'calc(62px + env(safe-area-inset-bottom))', sm: 0 } }}
      padding="md"
    >
      <AppShell.Navbar p="md">
        <Group gap={8} mb="lg" px="xs">
          <Text fz={26}>🔥</Text>
          <Text fw={900} fz="xl" variant="gradient">
            Improvr
          </Text>
        </Group>
        {TABS.map((t) => (
          <NavLink
            key={t.id}
            active={page === t.id}
            label={t.label}
            leftSection={<t.icon size={20} stroke={1.8} />}
            rightSection={t.id === 'today' && alerts ? <Badge size="xs" color="red" circle>!</Badge> : null}
            onClick={() => goTo(t.id)}
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
            mb={4}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main className="safe-top">
        <Container size={680} px={0} pb="xl">
          {page === 'today' && <TodayPage />}
          {page === 'calendar' && <CalendarPage />}
          {page === 'progress' && <ProgressPage />}
          {page === 'more' && <MorePage />}
        </Container>
      </AppShell.Main>

      <AppShell.Footer hiddenFrom="sm" className="tabbar">
        <Group grow gap={0} h={62}>
          {TABS.map((t) => {
            const active = page === t.id;
            return (
              <UnstyledButton key={t.id} onClick={() => goTo(t.id)} h="100%">
                <Stack gap={2} align="center" c={active ? 'violet.4' : 'dimmed'} pos="relative">
                  <t.icon size={24} stroke={active ? 2.2 : 1.6} />
                  <Text fz={11} fw={active ? 700 : 500}>
                    {t.label}
                  </Text>
                  {t.id === 'today' && alerts && (
                    <Badge size="xs" color="red" circle pos="absolute" top={-4} right={'calc(50% - 22px)'}>
                      !
                    </Badge>
                  )}
                </Stack>
              </UnstyledButton>
            );
          })}
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}
