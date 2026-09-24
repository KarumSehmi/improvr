import { Badge, Button, Modal, Stack, Text } from '@mantine/core';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { burst, fireworks } from '../lib/celebrate';
import { useSummary, useUi } from '../lib/hooks';
import { CHEST_TIERS, chestTier, rollChest, type ChestTier } from '../lib/moments';
import { sound } from '../lib/sound';
import { updateDay } from '../lib/store';

const LOOT: Record<ChestTier['tier'], { emoji: string; line: string }> = {
  common: { emoji: '🪙', line: 'Every day counts.' },
  rare: { emoji: '💎', line: 'Nice pull!' },
  epic: { emoji: '🔮', line: "Epic — that's a big one." },
  legendary: { emoji: '👑', line: 'LEGENDARY. Screenshot this.' },
};

/** Lock a day in on time and you get a chest with a random amount of XP. A perfect day's is golden. */
export default function ChestModal() {
  const date = useUi((s) => s.chestDate);
  const summary = useSummary();
  const e = date ? summary.evalByDate[date] : undefined;
  const stored = e?.log?.chest;
  const golden = !!e?.perfect;
  const [revealed, setRevealed] = useState<ChestTier | null>(null);
  const result = revealed ?? (stored != null ? chestTier(stored) : null);

  const close = () => {
    useUi.setState({ chestDate: null });
    setTimeout(() => setRevealed(null), 300);
  };

  const open = () => {
    if (!date || stored != null || revealed) return;
    const tier = rollChest(golden);
    updateDay(date, (l) => {
      l.chest ??= tier.xp;
    });
    setRevealed(tier);
    sound.sparkle();
    if (tier.tier === 'epic' || tier.tier === 'legendary') fireworks();
    else burst();
  };

  const odds = CHEST_TIERS.map((t) => `${Math.round((golden ? t.golden : t.odds) * 100)}% ${t.label.toLowerCase()}`).join(' · ');

  return (
    <Modal opened={!!date && !!e} onClose={close} withCloseButton={false} size="sm">
      <AnimatePresence mode="wait" initial={false}>
        {!result ? (
          <motion.div key="closed" exit={{ opacity: 0, scale: 0.9 }}>
            <Stack align="center" gap="xs" py="md">
              <Text fw={900} fz={22}>
                {golden ? '✨ Golden chest' : '🎁 Reward chest'}
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                {golden ? 'Perfect day — better odds!' : 'Locked in on time. What did you win?'}
              </Text>
              <motion.div
                onClick={open}
                animate={{ rotate: [0, -7, 7, -5, 5, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.6 }}
                style={{
                  fontSize: 92,
                  lineHeight: 1,
                  margin: '18px 0',
                  cursor: 'pointer',
                  filter: golden ? 'drop-shadow(0 0 22px rgba(255, 212, 59, 0.85))' : 'drop-shadow(0 0 18px rgba(151, 117, 250, 0.7))',
                }}
              >
                🎁
              </motion.div>
              <Button size="lg" variant="gradient" gradient={golden ? { from: 'yellow', to: 'orange' } : undefined} fullWidth onClick={open}>
                Open it
              </Button>
              <Text size="xs" c="dimmed" ta="center">
                {odds}
              </Text>
            </Stack>
          </motion.div>
        ) : (
          <motion.div key="open" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            <Stack align="center" gap="xs" py="md">
              <Badge size="lg" color={result.color} variant="filled">
                {result.label}
              </Badge>
              <motion.div
                initial={{ scale: 0.2, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}
                style={{ fontSize: 84, lineHeight: 1, margin: '10px 0' }}
              >
                {LOOT[result.tier].emoji}
              </motion.div>
              <Text fw={900} fz={44} lh={1} c="var(--xp)">
                +{result.xp} XP
              </Text>
              <Text size="sm" c="dimmed">
                {LOOT[result.tier].line}
              </Text>
              <Button mt="md" size="md" fullWidth onClick={close}>
                Collect
              </Button>
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
