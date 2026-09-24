/**
 * Full-screen moments: the first-run welcome, level-ups & new badges, and the weekly review.
 * Only one shows at a time, in that order of priority.
 */
import { Badge, Button, Card, Group, Modal, Progress, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { achievements, type Achievement } from '../lib/achievements';
import { burst, fireworks } from '../lib/celebrate';
import { QUOTE } from '../lib/config';
import { addDays, fmt, weekStart } from '../lib/dates';
import { grade, weekStats, type Summary, type WeekStats } from '../lib/engine';
import { useSummary, useToday, useUi } from '../lib/hooks';
import { updateSettings, useApp } from '../lib/store';

export default function Overlays() {
  const summary = useSummary();
  const today = useToday();
  const settings = useApp((s) => s.settings);
  const dayCount = useApp((s) => Object.keys(s.days).length);
  const manualReview = useUi((s) => s.reviewOpen);
  const list = useMemo(() => achievements(summary), [summary]);

  // Rewards
  const seen = settings.seenAchievements ?? [];
  const fresh = list.filter((a) => a.unlocked && !seen.includes(a.id));
  const seenLevel = settings.seenLevel ?? 1;
  const levelUp = summary.level.level > seenLevel;

  // Weekly review: once per week, as soon as there's a finished week worth reviewing
  const ws = weekStart(today);
  const lastWeek = weekStats(summary, addDays(ws, -7));
  const reviewDue = settings.reviewedWeek !== ws && lastWeek.days >= 3;

  const welcome = !settings.onboarded && dayCount === 0;
  const showRewards = !welcome && (fresh.length > 0 || levelUp);
  const showReview = !welcome && !showRewards && (reviewDue || manualReview);

  return (
    <>
      <WelcomeModal opened={welcome} />
      <RewardsModal
        opened={showRewards}
        level={levelUp ? summary.level : null}
        fresh={fresh}
        onClose={() => updateSettings({ seenAchievements: list.filter((a) => a.unlocked).map((a) => a.id), seenLevel: summary.level.level })}
      />
      <ReviewModal
        opened={showReview}
        summary={summary}
        stats={lastWeek}
        before={weekStats(summary, addDays(ws, -14))}
        onClose={() => {
          useUi.setState({ reviewOpen: false });
          if (settings.reviewedWeek !== ws) updateSettings({ reviewedWeek: ws });
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function WelcomeModal({ opened }: { opened: boolean }) {
  const settings = useApp((s) => s.settings);
  const [name, setName] = useState(settings.name);
  const [charity, setCharity] = useState('');
  const [donateUrl, setDonateUrl] = useState('');
  const finish = () => {
    updateSettings({
      name: name.trim(),
      charity: charity.trim() || settings.charity,
      donateUrl: donateUrl.trim() || undefined,
      onboarded: true,
      seenLevel: 1,
      seenAchievements: [],
    });
    burst();
  };

  return (
    <Modal opened={opened} onClose={finish} withCloseButton={false} size="md" closeOnClickOutside={false}>
      <Stack>
        <div>
          <Text fz={44}>🔥</Text>
          <Title order={2}>Welcome to Improvr</Title>
          <Text c="dimmed" size="sm" fs="italic">
            {QUOTE}
          </Text>
        </div>
        <Card p="sm">
          <Stack gap={6}>
            <Text size="sm">✅ Tick things off through the day — about 2 minutes total.</Text>
            <Text size="sm">🔒 Lock in each day by midnight the next day.</Text>
            <Text size="sm">💷 Miss it and you owe £{settings.fineAmount} to charity. That's the only punishment.</Text>
            <Text size="sm">🏖️ One day off per week. Streaks freeze.</Text>
          </Stack>
        </Card>
        <TextInput label="What should I call you?" placeholder="Your name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Charity for fines" placeholder="e.g. British Heart Foundation" value={charity} onChange={(e) => setCharity(e.currentTarget.value)} />
        <TextInput
          label="Donation link (optional)"
          description="So paying a fine is one tap"
          placeholder="https://…"
          value={donateUrl}
          onChange={(e) => setDonateUrl(e.currentTarget.value)}
        />
        <Button size="lg" variant="gradient" onClick={finish}>
          Let's go
        </Button>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function RewardsModal({ opened, level, fresh, onClose }: { opened: boolean; level: Summary['level'] | null; fresh: Achievement[]; onClose: () => void }) {
  useEffect(() => {
    if (opened) fireworks();
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} size="md">
      <Stack align="center" gap="md" py="sm">
        {level && (
          <Stack align="center" gap={4}>
            <div className="eyebrow">Level up</div>
            <motion.div initial={{ scale: 0.3, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
              <Text fz={80} fw={900} lh={1} variant="gradient">
                {level.level}
              </Text>
            </motion.div>
            <Title order={2}>{level.title}</Title>
          </Stack>
        )}
        {fresh.length > 0 && (
          <Stack align="center" gap="sm" w="100%">
            <div className="eyebrow">{fresh.length === 1 ? 'Badge unlocked' : `${fresh.length} badges unlocked`}</div>
            <SimpleGrid cols={fresh.length === 1 ? 1 : 2} spacing="sm" w="100%">
              {fresh.slice(0, 6).map((a, i) => (
                <motion.div key={a.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.08 }}>
                  <Card p="sm" ta="center" className="hero">
                    <Text fz={40}>{a.emoji}</Text>
                    <Text fw={800}>{a.title}</Text>
                    <Text size="xs" c="dimmed">
                      {a.detail}
                    </Text>
                  </Card>
                </motion.div>
              ))}
            </SimpleGrid>
            {fresh.length > 6 && (
              <Text size="xs" c="dimmed">
                +{fresh.length - 6} more on the Progress page
              </Text>
            )}
          </Stack>
        )}
        <Button size="lg" variant="gradient" fullWidth onClick={onClose}>
          Let's keep going
        </Button>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function Delta({ now, before, suffix = '', invert }: { now: number | null; before: number | null; suffix?: string; invert?: boolean }) {
  if (now == null || before == null || now === before) return null;
  const up = now > before;
  const good = invert ? !up : up;
  return (
    <Text span size="xs" fw={800} c={good ? 'teal.4' : 'red.4'}>
      {' '}
      {up ? '▲' : '▼'} {Math.abs(Math.round((now - before) * 10) / 10)}
      {suffix}
    </Text>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: ReactNode }) {
  return (
    <Card p="xs" radius="lg">
      <Text fw={900} fz={20}>
        {value}
        {delta}
      </Text>
      <Text size="xs" c="dimmed" fw={600}>
        {label}
      </Text>
    </Card>
  );
}

function ReviewModal({ opened, summary, stats, before, onClose }: { opened: boolean; summary: Summary; stats: WeekStats; before: WeekStats; onClose: () => void }) {
  const settings = useApp((s) => s.settings);
  const today = useToday();
  const rated = stats.rates.filter((r) => r.required >= 3);
  const best = [...rated].sort((a, b) => b.rate - a.rate).slice(0, 3);
  const worst = [...rated].sort((a, b) => a.rate - b.rate).filter((r) => r.rate < 1).slice(0, 3);
  const [focus, setFocus] = useState<string | null>(null);
  const suggested = worst[0]?.habit.id ?? null;
  const g = grade(stats.avgPct);
  const slips = Object.entries(stats.slips).filter(([, n]) => n > 0);
  const ws = weekStart(today);

  const start = () => {
    const habitId = focus ?? suggested;
    updateSettings({ reviewedWeek: ws, focus: habitId ? { week: ws, habitId } : null });
    burst();
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={800}>Week of {fmt(stats.start, 'D MMM')}</Text>} size="lg">
      <Stack>
        <Group wrap="nowrap" gap="md">
          <Card p="md" className="hero" style={{ flexShrink: 0 }}>
            <Text fz={48} fw={900} lh={1} ta="center" c={`${g.color}.4`}>
              {g.letter}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              {stats.avgPct ?? '—'}% avg
            </Text>
          </Card>
          <div>
            <Title order={3}>
              {stats.avgPct != null && before.avgPct != null
                ? stats.avgPct > before.avgPct
                  ? 'Better than the week before 📈'
                  : stats.avgPct === before.avgPct
                    ? 'Level with the week before'
                    : 'A step back — reset and go again'
                : 'Your first full week 🎉'}
            </Title>
            <Text size="sm" c="dimmed">
              {QUOTE}
            </Text>
          </div>
        </Group>

        <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs">
          <Stat label="Average score" value={`${stats.avgPct ?? '—'}%`} delta={<Delta now={stats.avgPct} before={before.avgPct} suffix="%" />} />
          <Stat label="Days logged" value={`${stats.logged}/${stats.days}`} />
          <Stat label="Gym sessions" value={`${stats.sessions}/${settings.workoutTarget}`} delta={<Delta now={stats.sessions} before={before.sessions} />} />
          <Stat label="XP earned" value={stats.xp.toLocaleString()} delta={<Delta now={stats.xp} before={before.xp} />} />
          <Stat label="Perfect days" value={String(stats.perfect)} />
          {stats.moodAvg != null && <Stat label="Mood" value={`${stats.moodAvg.toFixed(1)}/5`} delta={<Delta now={stats.moodAvg} before={before.moodAvg} />} />}
          <Stat label="Slips" value={String(slips.reduce((s, [, n]) => s + n, 0))} delta={<Delta now={slips.reduce((s, [, n]) => s + n, 0)} before={Object.values(before.slips).reduce((a, b) => a + b, 0)} invert />} />
        </SimpleGrid>

        {best.length > 0 && (
          <div>
            <div className="eyebrow">Smashed it</div>
            <Group gap={6} mt={6}>
              {best.map((r) => (
                <Badge key={r.habit.id} size="lg" variant="light" color="teal" leftSection={r.habit.emoji} style={{ textTransform: 'none' }}>
                  {r.habit.label} {r.done}/{r.required}
                </Badge>
              ))}
            </Group>
          </div>
        )}

        {worst.length > 0 && (
          <div>
            <div className="eyebrow">Needs work</div>
            <Stack gap={6} mt={6}>
              {worst.map((r) => (
                <Group key={r.habit.id} gap="xs" wrap="nowrap">
                  <Text w={24}>{r.habit.emoji}</Text>
                  <Text size="sm" style={{ flex: 1 }} truncate>
                    {r.habit.label}
                  </Text>
                  <Progress value={r.rate * 100} w={80} size="sm" color="orange" />
                  <Text size="xs" w={34} ta="right">
                    {r.done}/{r.required}
                  </Text>
                </Group>
              ))}
            </Stack>
          </div>
        )}

        {slips.length > 0 && (
          <Text size="sm" c="dimmed">
            Slips:{' '}
            {slips.map(([id, n]) => `${summary.habits.find((h) => h.id === id)?.label ?? id} ×${n}`).join(' · ')}
          </Text>
        )}

        <Select
          label="🎯 Pick one focus for this week"
          description="It gets pinned on your Today page"
          data={summary.habits.map((h) => ({ value: h.id, label: `${h.emoji} ${h.label}` }))}
          value={focus ?? suggested}
          onChange={setFocus}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        <Button size="lg" variant="gradient" onClick={start}>
          Start the week
        </Button>
      </Stack>
    </Modal>
  );
}
