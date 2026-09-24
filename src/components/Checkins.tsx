import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AnimatePresence, motion } from 'motion/react';
import type { MouseEvent } from 'react';
import { BONUS, CHECKINS, ENERGY } from '../lib/config';
import { fireworks, pop } from '../lib/celebrate';
import { formatCountdown, type DateKey } from '../lib/dates';
import { floatXp } from '../lib/feedback';
import { useNow } from '../lib/hooks';
import { checkinStates, currentCheckin } from '../lib/moments';
import { sound } from '../lib/sound';
import { updateDay, useApp } from '../lib/store';
import type { DayLog } from '../lib/types';
import { Tap } from './ui';

const pad = (n: number) => String(n % 24).padStart(2, '0');

/** Morning, afternoon and evening check-ins: one tap each for XP, and a reason to come back. */
export default function CheckinStrip({ date, log }: { date: DateKey; log: DayLog | undefined }) {
  const now = useNow();
  const states = checkinStates(date, log, new Date(now));
  const current = currentCheckin(new Date(now));
  const open = current.date === date && states[current.id] === 'open' ? current : null;
  const def = open ? CHECKINS.find((c) => c.id === open.id)! : null;

  const checkIn = (energy: number, e: MouseEvent) => {
    if (!open) return;
    updateDay(date, (l) => {
      l.checkins = { ...l.checkins, [open.id]: { at: Date.now(), energy } };
    });
    pop(e);
    const all = Object.keys(useApp.getState().days[date]?.checkins ?? {}).length >= CHECKINS.length;
    floatXp(e, `+${BONUS.checkin + (all ? BONUS.allCheckins : 0)}`);
    if (all) {
      fireworks();
      notifications.show({ color: 'yellow', title: '🎯 Hat-trick!', message: `Checked in morning, afternoon and evening: +${BONUS.allCheckins} bonus XP.` });
    } else sound.chime();
  };

  return (
    <div>
      <div className="checkins">
        {CHECKINS.map((c) => {
          const st = states[c.id];
          const energy = log?.checkins?.[c.id]?.energy;
          const sub =
            st === 'done'
              ? `✓ +${BONUS.checkin} XP`
              : st === 'open'
                ? `${formatCountdown(current.endsAt - now)} left`
                : st === 'later'
                  ? `from ${pad(c.from)}:00`
                  : 'missed';
          return (
            <div key={c.id} className="checkin" data-state={st}>
              <span className="checkin-emoji">{st === 'done' && energy ? ENERGY[energy - 1].emoji : c.emoji}</span>
              <div className="checkin-label">{c.label}</div>
              <div className="checkin-sub">{sub}</div>
            </div>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {def && (
          <motion.div key={def.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <Text size="sm" fw={800} mt="sm" mb={6}>
              How's your energy right now?{' '}
              <Text span c="var(--xp)" fw={900}>
                +{BONUS.checkin} XP
              </Text>
            </Text>
            <div className="energy">
              {ENERGY.map((x) => (
                <Tap key={x.value} className="energy-btn" onClick={(e) => checkIn(x.value, e)} aria-label={x.label}>
                  {x.emoji}
                  <span>{x.label}</span>
                </Tap>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
