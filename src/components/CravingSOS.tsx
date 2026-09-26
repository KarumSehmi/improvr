import { ActionIcon, Button, Card, Chip, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconRefresh, IconX } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { BONUS } from '../lib/config';
import { burst, pop } from '../lib/celebrate';
import { IDEAS, SOS_MINUTES, breathAt, cravingPeak, logUrge } from '../lib/cravings';
import { slipStats } from '../lib/engine';
import { floatXp } from '../lib/feedback';
import { openSos, useSummary, useUi } from '../lib/hooks';
import { logicalNow } from '../lib/moments';
import { updateDay, updateSettings, useApp } from '../lib/store';
import { ScoreRing, Tap } from './ui';

const TOTAL = SOS_MINUTES * 60;
const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

/** Keep the screen on while the timer runs (iOS 16.4+). */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      .request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [on]);
}

/** A craving hits: ride it out for 10 minutes with a breathing guide and something else to do. */
export default function CravingSOS() {
  const sos = useUi((s) => s.sos);
  const summary = useSummary();
  const settings = useApp((s) => s.settings);
  const days = useApp((s) => s.days);
  const habits = summary.habits.filter((h) => h.kind === 'avoid');
  const [picked, setPicked] = useState<string | null>(null);
  const [idea, setIdea] = useState(0);
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [session, setSession] = useState<number | null>(null);

  // A fresh start each time it's opened
  if ((sos?.start ?? null) !== session) {
    setSession(sos?.start ?? null);
    setPicked(null);
    setEditing(false);
    if (sos) setIdea(Math.floor((sos.start / 1000) % IDEAS.length));
  }

  useEffect(() => {
    if (!sos) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [sos]);
  useWakeLock(!!sos);

  const id = picked ?? sos?.habit ?? habits[0]?.id;
  const habit = habits.find((h) => h.id === id);
  if (!sos || !habit) return null;

  const elapsed = Math.max(0, (now - sos.start) / 1000);
  const left = Math.max(0, TOTAL - elapsed);
  const finished = left === 0;
  const breath = breathAt(elapsed);
  const what = habit.label.replace(/^No /, '').toLowerCase();
  const stats = slipStats(summary).find((s) => s.habit.id === habit.id);
  const streak = summary.habitStreaks[habit.id]?.current ?? 0;
  const peak = cravingPeak(summary, habit.id);
  const reason = settings.reasons?.[habit.id] ?? '';
  const date = logicalNow(new Date(now)).date;
  const beatenToday = days[date]?.urges?.[habit.id] ?? 0;
  const close = () => useUi.setState({ sos: null });

  const passed = () => {
    updateDay(date, (l) => logUrge(l, habit.id, Date.now()));
    pop();
    burst();
    if (beatenToday < BONUS.urgeCap) floatXp(undefined, `+${BONUS.urge}`);
    notifications.show({ color: 'teal', title: '💪 Craving beaten', message: `That's ${(stats?.urgesAll ?? 0) + 1} so far. Each one gets easier.` });
    close();
  };

  const slipped = () =>
    modals.openConfirmModal({
      title: 'Log a slip?',
      children: <Text size="sm">Honesty beats streaks. It'll show as a slip for today; tomorrow is a fresh start.</Text>,
      labels: { confirm: 'Log it', cancel: 'Not yet' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        updateDay(date, (l) => {
          l.avoid = { ...l.avoid, [habit.id]: 'slip' };
        });
        notifications.show({ color: 'gray', title: 'Logged. Honesty beats streaks.', message: 'Be better tomorrow than you were today.' });
        close();
      },
    });

  return (
    <Modal opened onClose={close} fullScreen withCloseButton={false} transitionProps={{ transition: 'slide-up' }} padding={0}>
      <Stack gap="md" p="md" maw={520} mx="auto" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={900} fz={24}>
            🆘 Craving
          </Text>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={close} aria-label="Close">
            <IconX size={22} />
          </ActionIcon>
        </Group>

        {habits.length > 1 && (
          <Chip.Group value={habit.id} onChange={(v) => setPicked(v as string)}>
            <Group gap={6}>
              {habits.map((h) => (
                <Chip key={h.id} value={h.id} size="sm" variant="light">
                  {h.emoji} {h.label.replace(/^No /, '')}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        )}

        <Stack align="center" gap={6} my="xs">
          <div style={{ position: 'relative', width: 230, height: 230, display: 'grid', placeItems: 'center' }}>
            <motion.div
              animate={{ scale: finished ? 1 : breath.scale }}
              transition={{ duration: breath.phase === 'Breathe out' ? 6 : 4, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: 170,
                height: 170,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(56, 217, 169, 0.45), rgba(51, 154, 240, 0.15) 70%, transparent)',
              }}
            />
            <ScoreRing value={(elapsed / TOTAL) * 100} size={230} stroke={8} color="teal">
              <Stack gap={2} align="center">
                <Text fw={900} fz={44} lh={1} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {finished ? '✓' : clock(left)}
                </Text>
                <Text size="sm" fw={700} c="teal.3">
                  {finished ? 'You rode it out' : `${breath.phase} · ${breath.left}`}
                </Text>
              </Stack>
            </ScoreRing>
          </div>
          <Text size="sm" c="dimmed" ta="center" maw={360}>
            {finished
              ? `${SOS_MINUTES} minutes. That's the hard part done.`
              : `Cravings peak and pass in about ${SOS_MINUTES} minutes. You don't have to fight it — just don't give in before this hits zero.`}
          </Text>
        </Stack>

        <Card p="sm">
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <Text fz={28}>{IDEAS[idea].emoji}</Text>
              <div style={{ minWidth: 0 }}>
                <div className="eyebrow">Do this instead</div>
                <Text fw={700} size="sm">
                  {IDEAS[idea].text}
                </Text>
              </div>
            </Group>
            <ActionIcon variant="light" size="lg" onClick={() => setIdea((idea + 1) % IDEAS.length)} aria-label="Another idea">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>
        </Card>

        <Card p="sm">
          <div className="eyebrow">Why you're doing this</div>
          {reason && !editing ? (
            <Text fw={700} mt={4} onClick={() => setEditing(true)} style={{ cursor: 'text' }}>
              “{reason}”
            </Text>
          ) : (
            <Textarea
              mt={6}
              autosize
              minRows={2}
              placeholder={`e.g. Better lungs for football, and £ back in my pocket`}
              defaultValue={reason}
              onBlur={(e) => {
                updateSettings({ reasons: { ...settings.reasons, [habit.id]: e.currentTarget.value.trim() } });
                setEditing(false);
              }}
            />
          )}
          <Text size="xs" c="dimmed" mt={8}>
            🔥 {streak} day{streak === 1 ? '' : 's'} {what}-free
            {stats?.saved ? ` · 💰 £${stats.saved} saved` : ''} · 💪 {stats?.urgesAll ?? 0} cravings beaten
            {peak ? ` · they usually hit ${peak.label}` : ''}
          </Text>
        </Card>

        <Button size="lg" variant="gradient" gradient={{ from: 'teal.5', to: 'green.6', deg: 135 }} onClick={passed}>
          💪 {finished ? 'Log it' : 'It passed'} {beatenToday < BONUS.urgeCap ? `(+${BONUS.urge} XP)` : ''}
        </Button>
        <Button variant="subtle" color="red" onClick={slipped}>
          I slipped
        </Button>
      </Stack>
    </Modal>
  );
}

/** Always-there button on Today for when a craving hits. */
export function SosButton() {
  const any = useSummary().habits.some((h) => h.kind === 'avoid');
  if (!any) return null;
  return (
    <Tap className="sos-fab" onClick={() => openSos()} aria-label="Craving SOS">
      🆘 <span>Craving</span>
    </Tap>
  );
}
