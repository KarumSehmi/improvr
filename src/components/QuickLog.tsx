/**
 * The + button: log anything from anywhere. Quick actions on top, then whatever's still open
 * (what's due now first), and a search box that finds any habit or to-do.
 */
import { Collapse, Group, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { bump, checkIn, logWorkout, toggleQuest, toggleWorkout, targetOf } from '../lib/actions';
import { CHECKINS, SECTION_BY_ID, WORKOUTS, featureOn } from '../lib/config';
import { addDays, fmt, weekday } from '../lib/dates';
import type { ItemEval } from '../lib/engine';
import { logDate, openSos, useNow, useSummary, useToday, useUi } from '../lib/hooks';
import { checkinStates, currentCheckin, logicalNow, questFor } from '../lib/moments';
import { useApp } from '../lib/store';
import { openTodos } from '../lib/todos';
import { openNowAndLater } from '../lib/wrap';
import { EnergyPicker } from './Checkins';
import HabitRow from './HabitRow';
import { QuickAdd, TodoRow } from './Todos';
import { Sheet, Tap } from './ui';

function Tile({ emoji, label, sub, done, onClick }: { emoji: string; label: string; sub?: ReactNode; done?: boolean; onClick: (e: MouseEvent) => void }) {
  return (
    <Tap className="quick-tile" data-done={done || undefined} onClick={onClick} aria-label={label}>
      <span className="quick-tile-emoji">{emoji}</span>
      <span>
        {label}
        {sub != null && <small>{sub}</small>}
      </span>
    </Tap>
  );
}

function Group2({ title, count, children, defaultOpen = true }: { title: string; count: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!count) return null;
  return (
    <div>
      <UnstyledButton onClick={() => setOpen(!open)} w="100%" mb={2}>
        <Group justify="space-between">
          <div className="eyebrow">
            {title} · {count}
          </div>
          <IconChevronDown size={15} style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
        </Group>
      </UnstyledButton>
      <Collapse expanded={open}>{children}</Collapse>
    </div>
  );
}

export default function QuickLog() {
  const opened = useUi((s) => s.logOpen);
  const close = () => useUi.setState({ logOpen: false });
  return (
    <Sheet opened={opened} onClose={close} size="lg">
      {opened && <Body close={close} />}
    </Sheet>
  );
}

function Body({ close }: { close: () => void }) {
  const now = useNow();
  const today = useToday();
  const summary = useSummary();
  const days = useApp((s) => s.days);
  const todos = useApp((s) => s.todos);
  const settings = useApp((s) => s.settings);
  const wide = useMediaQuery('(min-width: 48em)');
  const [q, setQ] = useState('');
  const date = logDate(now, summary);
  const e = summary.evalByDate[date];
  const log = days[date];
  const moment = logicalNow(new Date(now));
  const live = moment.date === date;

  if (!e) return <Text c="dimmed">Nothing to log yet — tracking starts on {fmt(settings.startDate, 'D MMM')}.</Text>;

  const { now: dueNow, later, bonus } = openNowAndLater(e, moment.hour, live, settings);
  const water = e.items.find((i) => i.habit.kind === 'water' && i.visible);
  const gym = log?.workouts?.includes('gym');
  const football = WORKOUTS.find((w) => w.id === 'football')!;
  const states = checkinStates(date, log, new Date(now));
  const cur = currentCheckin(new Date(now));
  const checkinOpen = featureOn(settings, 'checkins') && cur.date === date && states[cur.id] === 'open';
  const quest = questFor(date, log?.quest?.swap ?? 0);
  const questOn = featureOn(settings, 'quest') && !e.dayOff;
  const hasAvoid = summary.habits.some((h) => h.kind === 'avoid');
  const todosOpen = date === today ? openTodos(todos, today) : [];

  const row = (i: ItemEval) => (
    <HabitRow
      key={i.habit.id}
      item={i}
      date={date}
      log={log}
      streak={summary.habitStreaks[i.habit.id]}
      color={SECTION_BY_ID[i.habit.section].color}
      focus={false}
      atRisk={false}
    />
  );

  // Searching: any habit on today's list (done or not) and any open to-do
  const needle = q.trim().toLowerCase();
  const found = needle ? e.items.filter((i) => i.visible && `${i.habit.label} ${i.habit.hint ?? ''} ${SECTION_BY_ID[i.habit.section].title}`.toLowerCase().includes(needle)) : [];
  const foundTodos = needle ? Object.values(todos).filter((t) => !t.doneOn && t.title.toLowerCase().includes(needle)) : [];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Group justify="space-between" align="flex-end" mt={wide ? 0 : 4}>
        <div>
          <div className="eyebrow">{date === today ? 'Today' : `${fmt(date, 'dddd')} · still open`}</div>
          <Text fw={850} fz={24} lh={1.15} lts={-0.4}>
            Log something
          </Text>
        </div>
        <Text size="sm" fw={800} c="dimmed" className="num">
          {e.completed}/{e.required} done
        </Text>
      </Group>

      <TextInput
        placeholder="Find a habit or to-do…"
        leftSection={<IconSearch size={16} />}
        rightSection={
          q ? (
            <UnstyledButton onClick={() => setQ('')} aria-label="Clear" style={{ display: 'grid' }}>
              <IconX size={16} />
            </UnstyledButton>
          ) : null
        }
        value={q}
        onChange={(ev) => setQ(ev.currentTarget.value)}
        radius="xl"
        size="md"
        autoFocus={wide}
      />

      {needle ? (
        <div>
          {found.map(row)}
          {foundTodos.map((t) => (
            <TodoRow key={t.id} todo={t} today={today} showDate />
          ))}
          {!found.length && !foundTodos.length && (
            <Text size="sm" c="dimmed" ta="center" py="md">
              Nothing called "{q}" today. Add it as a to-do below, or as a habit in Settings.
            </Text>
          )}
        </div>
      ) : (
        <>
          <div className="quick-grid">
            {water && (
              <Tile
                emoji="🚰"
                label="Water"
                sub={`${log?.water ?? 0}/${targetOf(water.habit)}`}
                done={water.done}
                onClick={(ev) => bump(date, water.habit, 1, ev)}
              />
            )}
            {settings.workoutTarget > 0 && <Tile emoji="🏋️" label="Gym" sub={gym ? 'logged ✓' : `+${WORKOUTS[0].points} XP`} done={gym} onClick={(ev) => toggleWorkout(date, 'gym', ev)} />}
            {(weekday(date) === 1 || log?.workouts?.includes('football')) && (
              <Tile emoji="⚽" label="Football" sub={log?.workouts?.includes('football') ? 'logged ✓' : `+${football.points} XP`} done={log?.workouts?.includes('football')} onClick={(ev) => (log?.workouts?.includes('football') ? toggleWorkout(date, 'football') : logWorkout(date, 'football', ev))} />
            )}
            {questOn && <Tile emoji="🎲" label="Quest" sub={log?.quest?.done ? 'done ✓' : `${quest.emoji} +15 XP`} done={!!log?.quest?.done} onClick={(ev) => toggleQuest(date, !!log?.quest?.done, ev)} />}
            {featureOn(settings, 'budget') && date === today && (
              <Tile
                emoji="💳"
                label="Card"
                sub="spending"
                onClick={() => {
                  close();
                  useUi.setState({ cardOpen: true });
                }}
              />
            )}
            {hasAvoid && featureOn(settings, 'sos') && (
              <Tile
                emoji="🆘"
                label="Craving"
                sub="10 min SOS"
                onClick={() => {
                  close();
                  openSos();
                }}
              />
            )}
            {!e.closed && (
              <Tile
                emoji="🌙"
                label="Wrap up"
                sub={e.dayOff ? 'day off' : 'one at a time'}
                onClick={() => {
                  close();
                  useUi.setState({ wrapDate: date });
                }}
              />
            )}
            {date !== today ? (
              <Tile
                emoji="📅"
                label="Yesterday"
                sub="open it"
                onClick={() => {
                  close();
                  useUi.setState({ page: 'today', viewDate: addDays(today, -1) });
                }}
              />
            ) : null}
          </div>

          {checkinOpen && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                ⚡ {CHECKINS.find((c) => c.id === cur.id)!.label} check-in · +5 XP
              </div>
              <EnergyPicker onPick={(energy, ev) => checkIn(date, cur.id, energy, ev)} />
            </div>
          )}

          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              📝 Add a to-do
            </div>
            <QuickAdd today={today} placeholder='e.g. "dentist fri 3pm" or "haircut every 2 weeks"' />
          </div>

          {e.dayOff && (
            <Text size="sm" c="dimmed" ta="center">
              🏖️ Day off — streaks are frozen. Anything you tick still earns XP.
            </Text>
          )}

          <Group2 title={live ? 'Due now' : 'Still to do'} count={dueNow.length}>
            {dueNow.map(row)}
          </Group2>
          <Group2 title="To-dos" count={todosOpen.length}>
            {todosOpen.map((t) => (
              <TodoRow key={t.id} todo={t} today={today} />
            ))}
          </Group2>
          <Group2 title="Later today" count={later.length} defaultOpen={false}>
            {later.map(row)}
          </Group2>
          <Group2 title="Bonus" count={bonus.length} defaultOpen={false}>
            {bonus.map(row)}
          </Group2>
          {!dueNow.length && !later.length && !todosOpen.length && !e.dayOff && (
            <Text size="sm" c="dimmed" ta="center" py="xs">
              {e.closed ? '✅ Locked in. Nothing left to log.' : '🙌 Nothing left — everything is answered.'}
            </Text>
          )}
        </>
      )}
    </div>
  );
}
