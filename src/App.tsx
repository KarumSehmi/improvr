import { AppShell, Badge, Center, Container, Group, Loader, NavLink, Stack, Text } from '@mantine/core';
import { IconCalendar, IconChartBar, IconChecklist, IconDots } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ComponentType } from 'react';
import ChestModal from './components/ChestModal';
import Overlays from './components/Overlays';
import { FloaterLayer, Tap } from './components/ui';
import { goTo, useNow, useSummary, useUi, type Page } from './lib/hooks';
import { badgeCount, daypart, logicalNow } from './lib/moments';
import { updateSettings, useApp } from './lib/store';
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

/** Synced mode: remember your time zone and web address so the notification server gets times and links right. */
function useCloudSync() {
  const mode = useApp((s) => s.mode);
  const settings = useApp((s) => s.settings);

  useEffect(() => {
    if (mode !== 'cloud') return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const url = window.location.origin;
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    if ((tz && settings.timeZone !== tz) || (!isLocal && settings.appUrl !== url)) {
      updateSettings({ timeZone: tz || settings.timeZone, ...(isLocal ? {} : { appUrl: url }) });
    }
  }, [mode, settings.timeZone, settings.appUrl]);
}

/** The sky's colours follow the time of day, and the app icon shows how many things are due right now. */
function useSkyAndBadge(): number {
  const now = useNow();
  const summary = useSummary();
  const todos = useApp((s) => s.todos);
  const part = daypart(new Date(now));
  const { date, hour } = logicalNow(new Date(now));
  const count = badgeCount(summary.evalByDate[date], hour, todos, summary.today);

  useEffect(() => {
    document.documentElement.dataset.daypart = part;
  }, [part]);

  useEffect(() => {
    // Home Screen app on iPhone (iOS 16.4+), once notifications are allowed.
    if (!('setAppBadge' in navigator)) return;
    (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => {});
  }, [count]);

  return count;
}

function Shell() {
  const page = useUi((s) => s.page);
  const summary = useSummary();
  useCloudSync();
  const dueCount = useSkyAndBadge();
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
                {t.id === 'today' && (alerts || (dueCount > 0 && !active)) && (
                  <Badge size="xs" color="red" circle pos="absolute" top={-6} right={-10}>
                    {alerts ? '!' : dueCount}
                  </Badge>
                )}
              </div>
            </Tap>
          );
        })}
      </nav>

      <FloaterLayer />
      <Overlays />
      <ChestModal />
    </AppShell>
  );
}
