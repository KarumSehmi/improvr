import { AppShell, Badge, Center, Container, Group, Loader, NavLink, Stack, Text } from '@mantine/core';
import { IconCalendar, IconChartBar, IconChecklist, IconDots } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ComponentType } from 'react';
import Overlays from './components/Overlays';
import { FloaterLayer, Tap } from './components/ui';
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

const PAGES: Record<Page, ComponentType> = { today: TodayPage, calendar: CalendarPage, progress: ProgressPage, more: MorePage };

export default function App() {
  const status = useApp((s) => s.status);

  if (status === 'signedOut') return <LoginPage />;
  if (status === 'loading') {
    return (
      <Center h="100dvh">
        <Stack align="center" gap="xs">
          <Text fz={40}>🔥</Text>
          <Loader type="dots" />
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
  const Page = PAGES[page];

  return (
    <AppShell navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: true } }} padding="md">
      <AppShell.Navbar p="md" className="glass">
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
            rightSection={
              t.id === 'today' && alerts ? (
                <Badge size="xs" color="red" circle>
                  !
                </Badge>
              ) : null
            }
            onClick={() => goTo(t.id)}
            style={{ borderRadius: 'var(--mantine-radius-lg)' }}
            mb={4}
            fw={600}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main className="safe-top main-pad">
        <Container size={680} px={0}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
              <Page />
            </motion.div>
          </AnimatePresence>
        </Container>
      </AppShell.Main>

      <nav className="tabbar" data-hidden-desktop>
        {TABS.map((t) => {
          const active = page === t.id;
          return (
            <Tap key={t.id} className="tab" data-active={active || undefined} onClick={() => goTo(t.id)} aria-label={t.label}>
              {active && <motion.div layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 2 }}>
                <t.icon size={23} stroke={active ? 2.2 : 1.7} />
                <Text fz={10.5} fw={active ? 800 : 600}>
                  {t.label}
                </Text>
                {t.id === 'today' && alerts && (
                  <Badge size="xs" color="red" circle pos="absolute" top={-6} right={-10}>
                    !
                  </Badge>
                )}
              </div>
            </Tap>
          );
        })}
      </nav>

      <FloaterLayer />
      <Overlays />
    </AppShell>
  );
}
