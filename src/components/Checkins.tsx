import { Text } from '@mantine/core';
import { AnimatePresence, motion } from 'motion/react';
import type { MouseEvent } from 'react';
import { checkIn } from '../lib/actions';
import { BONUS, CHECKINS, ENERGY } from '../lib/config';
import { formatCountdown, type DateKey } from '../lib/dates';
import { useNow } from '../lib/hooks';
import { checkinStates, currentCheckin } from '../lib/moments';
import type { DayLog } from '../lib/types';
import { Tap } from './ui';

const pad = (n: number) => String(n % 24).padStart(2, '0');

/** How's your energy? Five big buttons. */
export function EnergyPicker({ onPick }: { onPick: (energy: number, e: MouseEvent) => void }) {
  return (
    <div className="energy">
      {ENERGY.map((x) => (
        <Tap key={x.value} className="energy-btn" onClick={(e) => onPick(x.value, e)} aria-label={x.label}>
          {x.emoji}
          <span>{x.label}</span>
        </Tap>
      ))}
    </div>
  );
}

/** Morning, afternoon and evening check-ins: one tap each for XP, and a reason to come back. */
export default function CheckinStrip({ date, log }: { date: DateKey; log: DayLog | undefined }) {
  const now = useNow();
  const states = checkinStates(date, log, new Date(now));
  const current = currentCheckin(new Date(now));
  const open = current.date === date && states[current.id] === 'open' ? current : null;
  const def = open ? CHECKINS.find((c) => c.id === open.id)! : null;

  return (
    <div>
      <div className="checkins">
        {CHECKINS.map((c) => {
          const st = states[c.id];
          const energy = log?.checkins?.[c.id]?.energy;
          const sub =
            st === 'done' ? `✓ +${BONUS.checkin} XP` : st === 'open' ? `open · ${formatCountdown(current.endsAt - now).replace(/ \d+m$/, '')}` : st === 'later' ? `from ${pad(c.from)}:00` : 'missed';
          return (
            <div key={c.id} className="checkin" data-state={st}>
              <span className="checkin-emoji">{st === 'done' && energy ? ENERGY[energy - 1].emoji : c.emoji}</span>
              <div style={{ minWidth: 0, display: 'grid', lineHeight: 1.15 }}>
                <span>{c.label}</span>
                <span className="checkin-sub">{sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {def && open && (
          <motion.div key={def.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <Text size="sm" fw={800} mt={12} mb={8}>
              {def.label} check-in: how's your energy?{' '}
              <Text span c="var(--xp)" fw={900}>
                +{BONUS.checkin} XP
              </Text>
            </Text>
            <EnergyPicker onPick={(energy, e) => checkIn(date, open.id, energy, e)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
