import { AppShell, Button, Center, Container, Group, Kbd, Loader, Stack, Text } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { IconCalendarEvent, IconChartBar, IconChecklist, IconPlus, IconSettings } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ComponentType } from 'react';
import ChestModal from './components/ChestModal';
import CravingSOS from './components/CravingSOS';
import { CardSheet } from './components/BudgetCard';
import HabitSheet from './components/HabitSheet';
import Overlays from './components/Overlays';
import QuickLog from './components/QuickLog';
import { TodoEditor } from './components/Todos';
import WrapUp from './components/WrapUp';
import { FloaterLayer, Tap } from './components/ui';
import { goTo, useNow, useSummary, useUi, type Page } from './lib/hooks';
import { runMigrations } from './lib/migrations';
import { clearDelivered } from './lib/push';
import { badgeCount, daypart, logicalNow } from './lib/moments';
import { updateSettings, useApp } from './lib/store';
import LoginPage from './pages/LoginPage';
import PlanPage from './pages/PlanPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';
import TodayPage from './pages/TodayPage';

type Icon = ComponentType<{ size?: number; stroke?: number }>;

const TABS: { id: Page; label: string; icon: Icon }[] = [
  { id: 'today', label: 'Today', icon: IconChecklist },
  { id: 'plan', label: 'Plan', icon: IconCalendarEvent },
  { id: 'progress', label: 'Progress', icon: IconChartBar },
  { id: 'settings', label: 'Settings', icon: IconSettings },
];

const PAGES: Record<Page, ComponentType> = { today: TodayPage, plan: PlanPage, progress: ProgressPage, settings: SettingsPage };

export default function App() {
  const status = useApp((s) => s.status);

  if (status === 'signedOut') return <LoginPage />;
  if (status === 'loading') {
    return (
      <Center h="100dvh">
        <Stack align="center" gap={8}>
          <Text fz={48} className="pulse" lh={1}>
            🔥
          </Text>
          <Text fw={900} fz={22} variant="gradient" lts={-0.5}>
            Improvr
          </Text>
          <Loader type="dots" size="sm" color="violet" />
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
  const count = badgeCount(summary.evalByDate[date], hour, todos, summary.today, summary.settings);

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

const openLog = () => useUi.setState({ logOpen: true });

function Shell() {
  const page = useUi((s) => s.page);
  const summary = useSummary();
  useCloudSync();
  const dueCount = useSkyAndBadge();
  useEffect(runMigrations, []);
  // Opening the app clears its notifications — you've seen what's due.
  useEffect(() => {
    const clear = () => document.visibilityState === 'visible' && void clearDelivered();
    clear();
    document.addEventListener('visibilitychange', clear);
    return () => document.removeEventListener('visibilitychange', clear);
  }, []);
  // Keyboard: L or N to log something, 1–4 for the pages.
  useHotkeys([
    ['l', openLog],
    ['n', openLog],
    ['1', () => goTo('today')],
    ['2', () => goTo('plan')],
    ['3', () => goTo('progress')],
    ['4', () => goTo('settings')],
  ]);
  const alerts = summary.owed > 0 || summary.openUnlogged.some((d) => d !== summary.today);
  const badge = alerts ? '!' : dueCount > 0 ? String(dueCount) : null;
  const Page = PAGES[page];

  const tab = (t: (typeof TABS)[number]) => {
    const active = page === t.id;
    return (
      <Tap
        key={t.id}
        className="tab"
        data-active={active || undefined}
        // Tapping the tab you're on scrolls back to the top
        onClick={() => (active ? window.scrollTo({ top: 0, behavior: 'smooth' }) : goTo(t.id))}
        aria-label={t.label}
        aria-current={active ? 'page' : undefined}
      >
        {active && <motion.div layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
        <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 3 }}>
          <t.icon size={23} stroke={active ? 2.2 : 1.7} />
          <span className="tab-label">{t.label}</span>
          {t.id === 'today' && badge && !(active && !alerts) && <span className="tab-badge">{badge}</span>}
        </div>
      </Tap>
    );
  };

  return (
    <AppShell navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: true } }} padding="md">
      <AppShell.Navbar p="md" className="side">
        <Group gap={8} mb="lg" px={6} mt={4}>
          <Text fz={26} lh={1}>
            🔥
          </Text>
          <Text fw={900} fz={21} variant="gradient" lts={-0.4}>
            Improvr
          </Text>
        </Group>
        <Button variant="gradient" size="md" radius="lg" leftSection={<IconPlus size={18} stroke={2.6} />} rightSection={<Kbd size="xs">L</Kbd>} onClick={openLog} mb="lg" justify="space-between">
          Log something
        </Button>
        <Stack gap={4}>
          {TABS.map((t, i) => {
            const active = page === t.id;
            return (
              <button key={t.id} type="button" className="side-link" data-active={active || undefined} onClick={() => goTo(t.id)}>
                <t.icon size={21} stroke={active ? 2.2 : 1.8} />
                <span style={{ flex: 1, textAlign: 'left' }}>{t.label}</span>
                {t.id === 'today' && badge ? (
                  <span className="tab-badge" style={{ position: 'static', boxShadow: 'none' }}>
                    {badge}
                  </span>
                ) : (
                  <Kbd size="xs" style={{ opacity: 0.5 }}>
                    {i + 1}
                  </Kbd>
                )}
              </button>
            );
          })}
        </Stack>
        <Text size="xs" c="dimmed" mt="auto" px={6} fs="italic">
          Just try to be better than you were yesterday.
        </Text>
      </AppShell.Navbar>

      <AppShell.Main className="safe-top main-pad">
        <Container size={page === 'today' ? 720 : 680} px={0}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              <Page />
            </motion.div>
          </AnimatePresence>
        </Container>
      </AppShell.Main>

      <nav className="tabbar" data-hidden-desktop aria-label="Pages">
        {TABS.slice(0, 2).map(tab)}
        <Tap className="plus" onClick={openLog} aria-label="Log something">
          <IconPlus size={28} stroke={2.6} />
        </Tap>
        {TABS.slice(2).map(tab)}
      </nav>

      <FloaterLayer />
      <Overlays />
      <ChestModal />
      <CravingSOS />
      <QuickLog />
      <WrapUp />
      <HabitSheet />
      <TodoEditor />
      <CardSheet />
    </AppShell>
  );
}
