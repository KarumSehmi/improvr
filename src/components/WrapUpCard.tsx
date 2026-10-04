import { Button, Card, Collapse, Group, List, Stack, Text, Textarea, UnstyledButton } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconBeach, IconLock, IconPlayerPlayFilled } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { motion } from 'motion/react';
import { useState } from 'react';
import { BONUS, MOODS, featureOn } from '../lib/config';
import { fmt, formatCountdown, logDeadline, relativeDay, type DateKey } from '../lib/dates';
import { dayOffUsedInWeek, isOpen, type DayEval } from '../lib/engine';
import { useNow, useToday, useUi } from '../lib/hooks';
import { lockDay } from '../lib/lock';
import { chestReady, chestTier, reflectionPrompt } from '../lib/moments';
import { updateDay, useApp } from '../lib/store';
import { PanelHead, Tap, accent } from './ui';

/** 😫 → 🤩, one tap (tap again to clear). */
export function MoodPicker({ date, mood, size = 46 }: { date: DateKey; mood: number | undefined; size?: number }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap={4}>
      {MOODS.map((m) => {
        const active = mood === m.value;
        return (
          <Tap key={m.value} aria-label={m.label} aria-pressed={active} onClick={() => updateDay(date, (l) => void (l.mood = active ? undefined : m.value))} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <motion.div
              animate={{ scale: active ? 1.16 : 1, opacity: mood && !active ? 0.35 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              style={{
                width: size,
                height: size,
                borderRadius: size * 0.34,
                display: 'grid',
                placeItems: 'center',
                fontSize: size * 0.56,
                background: active ? 'var(--brand-soft)' : 'transparent',
              }}
            >
              {m.emoji}
            </motion.div>
          </Tap>
        );
      })}
    </Group>
  );
}

/** "How can I be better tomorrow?" — saved as you type, and shown back to you tomorrow morning. */
export function NoteField({ date, note, autoFocus }: { date: DateKey; note: string; autoFocus?: boolean }) {
  const [value, setValue] = useState(note);
  const [editingDate, setEditingDate] = useState(date);
  if (editingDate !== date) {
    setEditingDate(date);
    setValue(note);
  }
  const save = useDebouncedCallback((v: string) => updateDay(date, (l) => void (l.note = v)), { delay: 600, flushOnUnmount: true });
  return (
    <Textarea
      autosize
      minRows={2}
      maxRows={6}
      label="How can I be better tomorrow?"
      placeholder={reflectionPrompt(date)}
      value={value}
      autoFocus={autoFocus}
      onChange={(ev) => {
        setValue(ev.currentTarget.value);
        save(ev.currentTarget.value);
      }}
      onBlur={() => save.flush()}
    />
  );
}

function takeDayOff(date: DateKey, label: string) {
  modals.openConfirmModal({
    title: `Use your day off for ${label}?`,
    children: (
      <Stack gap={6}>
        <Text size="sm">You get one per week (Mon–Sun). On a day off:</Text>
        <List size="sm" spacing={2}>
          <List.Item>Streaks are frozen — nothing breaks, nothing counts against you</List.Item>
          <List.Item>It counts as logged, so no fine</List.Item>
          <List.Item>Chores just carry over to tomorrow</List.Item>
          <List.Item>Anything you do tick still earns XP (and slips still count)</List.Item>
        </List>
      </Stack>
    ),
    labels: { confirm: 'Take the day off', cancel: 'Cancel' },
    onConfirm: () =>
      updateDay(date, (l) => {
        l.dayOff = true;
        l.closedAt ??= Date.now();
      }),
  });
}

/**
 * The end of the day: how it went, a note to tomorrow-you, and locking it in.
 * `early`: before the evening it's one compact line — wrapping up is for later.
 */
export default function WrapUpCard({ date, evaluation: e, early }: { date: DateKey; evaluation: DayEval; early?: boolean }) {
  const now = useNow();
  const today = useToday();
  const settings = useApp((s) => s.settings);
  const days = useApp((s) => s.days);
  const [unfolded, setUnfolded] = useState(false);
  const open = isOpen(date, today);
  const deadline = logDeadline(date);
  const usedOn = dayOffUsedInWeek(days, date);
  const label = relativeDay(date, today).toLowerCase();
  const fine = `£${settings.fineAmount}`;
  const deadlineText = dayjs(deadline).subtract(1, 'minute').format('ddd HH:mm');
  const note = e.log?.note ?? '';
  const mood = e.log?.mood;
  const left = e.items.filter((i) => i.required && !i.done && !i.missed && !i.skipped).length;
  const chestOn = featureOn(settings, 'chest');

  const dayOffLink = !e.dayOff && open && (
    <UnstyledButton onClick={() => !usedOn && takeDayOff(date, label)} disabled={!!usedOn} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: usedOn ? 0.5 : 1 }}>
      <IconBeach size={15} color="var(--mantine-color-blue-4)" />
      <Text size="xs" fw={750} c="blue.4">
        {usedOn ? `Day off used this week (${fmt(usedOn, 'ddd')})` : 'Take your day off instead (1 a week)'}
      </Text>
    </UnstyledButton>
  );

  const reflect = (
    <Stack gap="sm" mt="sm">
      <div>
        <Text size="sm" fw={700} mb={6}>
          How was {date === today ? 'today' : 'the day'}?
        </Text>
        <MoodPicker date={date} mood={mood} />
      </div>
      <NoteField date={date} note={note} />
    </Stack>
  );

  if (e.dayOff) {
    return (
      <Card id="lock-card" p="sm" px="md" style={{ ...accent('blue'), borderColor: 'color-mix(in srgb, var(--mantine-color-blue-5) 40%, transparent)' }}>
        <PanelHead
          emoji="🏖️"
          color="blue"
          title="Day off"
          sub="Streaks frozen. Counts as logged. Back at it tomorrow."
          right={
            open && (
              <Button variant="default" size="compact-sm" onClick={() => updateDay(date, (l) => void (l.dayOff = false))}>
                Undo
              </Button>
            )
          }
        />
      </Card>
    );
  }

  if (e.closed) {
    const chest = e.log?.chest;
    return (
      <Card id="lock-card" p="sm" px="md" style={{ borderColor: `color-mix(in srgb, var(--mantine-color-${e.onTime ? 'teal' : 'red'}-5) 40%, transparent)` }}>
        <PanelHead
          emoji={e.onTime ? '✅' : '⚠️'}
          color={e.onTime ? 'teal' : 'red'}
          title={e.onTime ? `Locked in ${label}` : 'Logged late'}
          sub={e.onTime ? `at ${dayjs(e.log?.closedAt ?? 0).format('HH:mm ddd')} · edit until ${deadlineText}` : `After the deadline — ${fine} to ${settings.charity}.`}
          right={
            <UnstyledButton onClick={() => setUnfolded(!unfolded)}>
              <Text size="xs" fw={750} c="dimmed">
                {unfolded ? 'Hide' : mood || note ? 'Your note' : 'Reflect'}
              </Text>
            </UnstyledButton>
          }
        />
        {chestOn && chestReady(e, today) && (
          <Button mt="sm" fullWidth variant="gradient" gradient={e.perfect ? { from: 'yellow', to: 'orange' } : undefined} onClick={() => useUi.setState({ chestDate: date })}>
            🎁 Open your {e.perfect ? 'golden ' : ''}reward chest
          </Button>
        )}
        {chest != null && (
          <Text size="sm" fw={750} mt="xs" c="var(--xp)">
            🎁 Chest: +{chest} XP ({chestTier(chest).label})
          </Text>
        )}
        <Collapse expanded={unfolded}>{reflect}</Collapse>
        {dayOffLink && <div style={{ marginTop: 10 }}>{dayOffLink}</div>}
      </Card>
    );
  }

  if (!open) {
    return (
      <Card id="lock-card" p="sm" px="md" style={{ borderColor: 'color-mix(in srgb, var(--mantine-color-red-6) 45%, transparent)' }}>
        <PanelHead emoji="⏰" color="red" title="Deadline missed" sub={`This day wasn't locked in on time — ${fine} to ${settings.charity}. You can still fill it in for your history.`} />
        {reflect}
        <Button mt="md" fullWidth variant="light" color="red" leftSection={<IconLock size={16} />} onClick={() => lockDay(date, e, open)}>
          Log it anyway (fine stands)
        </Button>
      </Card>
    );
  }

  if (early) {
    const expanded = unfolded || !!note || !!mood;
    return (
      <Card id="lock-card" p="sm" px="md" style={accent('indigo')}>
        <PanelHead
          emoji="🌙"
          color="indigo"
          title="Wrap up tonight"
          sub={`Lock in by ${deadlineText}${chestOn ? ' · +10 XP & a chest 🎁' : ` · +${BONUS.loggedOnTime} XP`}`}
          right={
            <Tap onClick={() => lockDay(date, e, open)} className="chip" style={{ color: 'var(--accent-text)', background: 'var(--accent-soft)', fontWeight: 800 }}>
              Lock in
            </Tap>
          }
        />
        <Collapse expanded={expanded}>{reflect}</Collapse>
        <Group justify="space-between" mt={10}>
          {!expanded ? (
            <UnstyledButton onClick={() => setUnfolded(true)}>
              <Text size="xs" fw={750} c="dimmed">
                ✍️ Write tonight's note now
              </Text>
            </UnstyledButton>
          ) : (
            <span />
          )}
          {dayOffLink}
        </Group>
      </Card>
    );
  }

  return (
    <Card id="lock-card" p="md" className="hero" style={accent('indigo')}>
      <PanelHead
        emoji="🌙"
        color="indigo"
        title={`Wrap up ${label}`}
        sub={date === today ? `Lock in before bed · deadline ${deadlineText}` : `${formatCountdown(deadline - now)} left to lock in · then it's ${fine} to charity`}
      />
      {reflect}
      <Stack gap={10} mt="md">
        {left > 0 && (
          <Button size="md" variant="default" leftSection={<IconPlayerPlayFilled size={14} />} onClick={() => useUi.setState({ wrapDate: date })} fullWidth>
            Go through the {left} left, one at a time
          </Button>
        )}
        <Button size="lg" variant="gradient" leftSection={<IconLock size={18} />} fullWidth onClick={() => lockDay(date, e, open)}>
          Lock in {label}
        </Button>
        <Text size="xs" c="dimmed" ta="center">
          On time = +{BONUS.loggedOnTime} XP{chestOn ? ' and a reward chest 🎁' : ''}
        </Text>
        <Group justify="center">{dayOffLink}</Group>
      </Stack>
    </Card>
  );
}
