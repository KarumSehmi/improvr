/**
 * Wrap up: everything that's still open, one big card at a time — then how the day went, a note
 * for tomorrow, and locking it in. The quickest way to log a whole day (about a minute).
 */
import { ActionIcon, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconArrowLeft, IconCheck, IconLock, IconX } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { answerClean, answerTime, bump, moveTodo, setDone, setMissed, setSkipped, targetOf, toggleTodo } from '../lib/actions';
import { pop } from '../lib/celebrate';
import { SECTION_BY_ID, habitLabel, scheduleLabel } from '../lib/config';
import { addDays, relativeDay, type DateKey } from '../lib/dates';
import { floatXp } from '../lib/feedback';
import { isOpen, type DayEval } from '../lib/engine';
import { useSummary, useToday, useUi } from '../lib/hooks';
import { lockDay } from '../lib/lock';
import { dayLabel, repeatLabel, timeLabel } from '../lib/quickadd';
import { useApp } from '../lib/store';
import { carriedDays } from '../lib/todos';
import { wrapQueue, type WrapStep } from '../lib/wrap';
import { ScoreRing, Stepper, Tap } from './ui';
import { accent } from '../lib/style';
import { MoodPicker, NoteField } from './WrapUpCard';

export default function WrapUp() {
  const date = useUi((s) => s.wrapDate);
  const close = () => useUi.setState({ wrapDate: null });
  return (
    <Modal opened={!!date} onClose={close} fullScreen withCloseButton={false} padding={0} transitionProps={{ transition: 'slide-up', duration: 240 }} zIndex={300}>
      {date && <Flow key={date} date={date} close={close} />}
    </Modal>
  );
}

/** Big answer button. */
function Answer({ tone, onClick, children, hotkey }: { tone?: 'good' | 'bad' | 'warn'; onClick: () => void; children: ReactNode; hotkey?: string }) {
  return (
    <Tap className="run-btn" data-tone={tone} onClick={onClick} aria-keyshortcuts={hotkey}>
      {children}
    </Tap>
  );
}

function Card({ color, eyebrow, emoji, title, sub }: { color: string; eyebrow: ReactNode; emoji: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="run-card" style={accent(color)}>
      <div className="eyebrow" style={{ color: 'var(--accent-text)' }}>
        {eyebrow}
      </div>
      <div className="run-emoji" style={{ margin: '18px 0 14px' }}>
        {emoji}
      </div>
      <Text fz={25} fw={850} lh={1.2} lts={-0.4}>
        {title}
      </Text>
      {sub && (
        <Text size="sm" c="dimmed" fw={600} mt={8}>
          {sub}
        </Text>
      )}
    </div>
  );
}

function Flow({ date, close }: { date: DateKey; close: () => void }) {
  const summary = useSummary();
  const todos = useApp((s) => s.todos);
  const days = useApp((s) => s.days);
  const settings = useApp((s) => s.settings);
  const today = useToday();
  const e = summary.evalByDate[date] as DayEval | undefined;
  // What's left when you start — answered things stay in the list so Back works.
  const [steps] = useState<WrapStep[]>(() => (e ? wrapQueue(e, todos, today) : []));
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  // What → / ← do for the card on screen (filled in below, read by the key handler after render).
  const keys: { yes?: () => void; no?: () => void } = {};
  const step = steps[i];
  const log = days[date];

  const next = () => {
    setDir(1);
    if (i + 1 < steps.length) setI(i + 1);
    else close();
  };
  const back = () => {
    if (i === 0) return;
    setDir(-1);
    setI(i - 1);
  };

  // Keyboard: → or Enter = yes / done, ← = no, Backspace = back, Esc = close
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement;
      if (target.closest('textarea, input')) return;
      // Enter on a focused button already presses it.
      if (ev.key === 'Enter' && target.closest('button, [role="button"]')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'Enter') keys.yes?.();
      else if (ev.key === 'ArrowLeft') keys.no?.();
      else if (ev.key === 'Backspace') back();
      else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!e || !step) return null;
  const open = isOpen(date, today);

  let body: ReactNode = null;
  if (step.kind === 'habit') {
    const item = e.items.find((x) => x.habit.id === step.id);
    if (!item) {
      Object.assign(keys, { yes: next });
      body = (
        <Stack gap="lg" align="center">
          <Text c="dimmed">That one isn't on your list any more.</Text>
          <Button onClick={next}>Next</Button>
        </Stack>
      );
    } else {
      const h = item.habit;
      const sec = SECTION_BY_ID[h.section];
      const streak = summary.habitStreaks[h.id];
      const label = habitLabel(h, settings, date);
      const bits = [
        streak?.current >= 2 ? `🔥 ${streak.current} in a row — keep it going` : streak?.best >= 5 ? `🏁 Best run: ${streak.best}` : null,
        item.overdueDays > 0 ? `${item.overdueDays} day${item.overdueDays === 1 ? '' : 's'} overdue` : null,
        h.kind === 'chore' && h.schedule ? scheduleLabel(h.schedule) : null,
        h.hint,
        h.kind === 'time' && log?.sleepAuto ? `⌚ ${h.id === 'sleep' ? `asleep ${log.sleepAuto.asleep}` : `up ${log.sleepAuto.awake}`}` : null,
        item.allowance && item.allowance.limit > 0 ? `${item.allowance.used}/${item.allowance.limit} allowed this week` : null,
      ].filter(Boolean);
      const sub = bits.join(' · ') || undefined;
      let buttons: ReactNode;
      if (h.kind === 'avoid') {
        const allowed = !!item.allowance && item.allowance.used < item.allowance.limit;
        Object.assign(keys, { yes: () => (answerClean(date, h, 'clean'), next()), no: () => (answerClean(date, h, 'slip'), next()) });
        buttons = (
          <>
            <Answer tone={allowed ? 'warn' : 'bad'} onClick={keys.no!}>
              {h.weeklyLimit ? (h.id === 'alcohol' ? 'Drank' : 'Did it') : 'Slipped'}
            </Answer>
            <Answer tone="good" onClick={keys.yes!}>
              <IconCheck size={20} stroke={3} /> Clean
            </Answer>
          </>
        );
      } else if (h.kind === 'time') {
        Object.assign(keys, { yes: () => (answerTime(date, h, true), next()), no: () => (answerTime(date, h, false), next()) });
        buttons = (
          <>
            <Answer tone="bad" onClick={keys.no!}>
              <IconX size={20} stroke={3} /> No
            </Answer>
            <Answer tone="good" onClick={keys.yes!}>
              <IconCheck size={20} stroke={3} /> Yes
            </Answer>
          </>
        );
      } else {
        Object.assign(keys, { yes: () => (setDone(date, h, true), next()), no: () => (setMissed(date, h, true), next()) });
        buttons = (
          <>
            <Answer tone="bad" onClick={keys.no!}>
              <IconX size={20} stroke={3} /> {h.kind === 'chore' ? 'Not today' : 'Not done'}
            </Answer>
            <Answer tone="good" onClick={keys.yes!}>
              <IconCheck size={20} stroke={3} /> Done
            </Answer>
          </>
        );
      }
      const value = h.kind === 'water' ? (log?.water ?? 0) : h.kind === 'count' ? (log?.counts?.[h.id] ?? 0) : 0;
      body = (
        <Stack gap="lg">
          <Card color={sec.color} eyebrow={`${sec.emoji} ${sec.title}`} emoji={h.emoji} title={label} sub={sub} />
          {(h.kind === 'water' || h.kind === 'count') && (
            <Group justify="center">
              <Stepper value={value} target={targetOf(h)} color={sec.color} onChange={(d, ev) => bump(date, h, d, ev)} />
            </Group>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{buttons}</div>
          <Group justify="center" gap="lg">
            {h.kind === 'chore' && (
              <Button variant="subtle" color="gray" size="compact-sm" onClick={() => (setSkipped(date, h, true), next())}>
                Skip this one
              </Button>
            )}
            <Button variant="subtle" color="gray" size="compact-sm" onClick={next}>
              Not sure yet →
            </Button>
          </Group>
        </Stack>
      );
    }
  } else if (step.kind === 'todo') {
    const t = todos[step.id];
    if (t) {
      const late = carriedDays(t, today);
      const sub = [late ? `↪ carried over ${late} day${late === 1 ? '' : 's'}` : t.date ? dayLabel(t.date, today) : null, t.time ? timeLabel(t.time) : null, t.repeat ? `↻ ${repeatLabel(t.repeat)}` : null].filter(Boolean).join(' · ');
      const done = !!t.doneOn;
      Object.assign(keys, {
        yes: () => {
          if (!done) {
            toggleTodo(t, today);
            pop();
            floatXp(undefined, 'Done ✓');
          }
          next();
        },
        no: () => (moveTodo(t, addDays(today, 1), 'tomorrow'), next()),
      });
      body = (
        <Stack gap="lg">
          <Card color="blue" eyebrow="📝 To-do" emoji={t.important ? '⭐' : '📝'} title={t.title} sub={sub || undefined} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Answer onClick={keys.no!}>→ Tomorrow</Answer>
            <Answer tone="good" onClick={keys.yes!}>
              <IconCheck size={20} stroke={3} /> Done
            </Answer>
          </div>
          <Group justify="center" gap="lg">
            <Button variant="subtle" color="gray" size="compact-sm" onClick={() => (moveTodo(t, null, 'someday'), next())}>
              Someday
            </Button>
            <Button variant="subtle" color="gray" size="compact-sm" onClick={next}>
              Leave it →
            </Button>
          </Group>
        </Stack>
      );
    } else {
      Object.assign(keys, { yes: next });
      body = (
        <Stack gap="lg" align="center">
          <Text c="dimmed">That to-do has gone.</Text>
          <Button onClick={next}>Next</Button>
        </Stack>
      );
    }
  } else if (step.kind === 'reflect') {
    Object.assign(keys, { yes: next });
    body = (
      <Stack gap="lg">
        <div className="run-card" style={accent('violet')}>
          <div className="eyebrow">How was {date === today ? 'today' : relativeDay(date, today).toLowerCase()}?</div>
          <div style={{ marginTop: 18 }}>
            <MoodPicker date={date} mood={log?.mood} size={52} />
          </div>
          <div style={{ marginTop: 18, textAlign: 'left' }}>
            <NoteField date={date} note={log?.note ?? ''} />
          </div>
        </div>
        <Button size="lg" variant="gradient" onClick={next}>
          {steps[i + 1] ? 'Next' : 'Finish'}
        </Button>
      </Stack>
    );
  } else if (step.kind === 'lock') {
    const pct = e.pct ?? 0;
    const lock = () => {
      close();
      lockDay(date, e, open);
    };
    Object.assign(keys, { yes: lock });
    body = (
      <Stack gap="lg" align="stretch">
        <div className="run-card" style={accent('violet')}>
          <div className="eyebrow">That's {date === today ? 'today' : relativeDay(date, today).toLowerCase()}</div>
          <Group justify="center" mt="lg" mb="sm">
            <ScoreRing value={pct} size={150} stroke={13} color={pct >= 100 ? 'teal' : 'brand'}>
              <Stack gap={0} align="center">
                <Text fz={38} fw={900} className="num" lh={1}>
                  {pct}%
                </Text>
                <Text size="xs" c="dimmed" fw={700}>
                  {e.completed}/{e.required} done
                </Text>
              </Stack>
            </ScoreRing>
          </Group>
          <Text fw={900} fz={20} c="var(--xp)">
            +{e.points} XP
          </Text>
          <Text size="sm" c="dimmed" fw={600} mt={6}>
            {open ? 'Lock it in on time for +10 XP and a reward chest.' : "It's past the deadline, so the fine stands — but it still counts for your history."}
          </Text>
        </div>
        <Button size="xl" variant="gradient" leftSection={<IconLock size={20} />} onClick={lock}>
          Lock in {relativeDay(date, today).toLowerCase()}
        </Button>
        <Button variant="subtle" color="gray" onClick={close}>
          Not yet
        </Button>
      </Stack>
    );
  }

  return (
    // Focus starts here rather than on ✕, so Enter answers the first question instead of closing.
    <div tabIndex={-1} data-autofocus style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', outline: 'none' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 10px) 16px 0', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={back} disabled={i === 0} aria-label="Back">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div style={{ flex: 1 }}>
            <div className="bar" style={{ height: 6 }}>
              <span style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
          <Text size="xs" fw={800} c="dimmed" className="num" w={44} ta="center">
            {i + 1}/{steps.length}
          </Text>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={close} aria-label="Close">
            <IconX size={20} />
          </ActionIcon>
        </Group>
        <Text ta="center" size="xs" fw={700} c="dimmed" mt={6}>
          🌙 Wrap up · {relativeDay(date, today)}
        </Text>
      </div>
      <div style={{ flex: 1, display: 'grid', alignItems: 'center', padding: '16px 16px calc(env(safe-area-inset-bottom) + 24px)', maxWidth: 520, width: '100%', margin: '0 auto', overflow: 'hidden' }}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={i}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
