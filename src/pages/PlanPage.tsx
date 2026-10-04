import { ActionIcon, Button, Card, ColorSwatch, Group, Menu, NumberInput, SegmentedControl, Select, Stack, Text, TextInput, Textarea, UnstyledButton, useComputedColorScheme } from '@mantine/core';
import { Calendar, DatePickerInput, TimeInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconCake, IconCalendarPlus, IconChecklist, IconChevronDown, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import Notice from '../components/Notice';
import { QuickAdd, TodoRow } from '../components/Todos';
import { M, Meta, Sheet, Tap, Tile, accent } from '../components/ui';
import { setDone } from '../lib/actions';
import { EVENT_COLORS, birthdaysOn, eventsBetween, eventsOn, upcomingBirthdays } from '../lib/calendar';
import { addDays, diffDays, fmt, maxKey, range, relativeDay, type DateKey } from '../lib/dates';
import { grade, isOpen, type Summary } from '../lib/engine';
import { openDay, useSummary, useToday, useUi } from '../lib/hooks';
import { dayLabel, timeLabel } from '../lib/quickadd';
import { scoreColor } from '../lib/scoreColors';
import { newId, removeItem, updateSettings, upsert, useApp } from '../lib/store';
import { groupTodos, openTodos, todoListsFor, todosOn } from '../lib/todos';
import type { Birthday, CalEvent, Todo, TodoList } from '../lib/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type EventDraft = Partial<CalEvent> | null;
type BirthdayDraft = Partial<Birthday> | null;

function confirmDelete(what: string, onConfirm: () => void) {
  modals.openConfirmModal({ title: `Delete ${what}?`, labels: { confirm: 'Delete', cancel: 'Cancel' }, confirmProps: { color: 'red' }, onConfirm });
}

export default function PlanPage() {
  const tab = useUi((s) => s.planTab);
  const today = useToday();
  const todos = useApp((s) => s.todos);
  const [event, setEvent] = useState<EventDraft>(null);
  const [birthday, setBirthday] = useState<BirthdayDraft>(null);
  const [listsOpen, setListsOpen] = useState(false);
  const due = openTodos(todos, today).length;

  return (
    <Stack gap={14}>
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <div>
          <div className="eyebrow">{fmt(today, 'dddd D MMMM')}</div>
          <Text component="h1" className="page-title" mt={4}>
            Plan
          </Text>
        </div>
        <Menu position="bottom-end" radius="lg" shadow="lg" width={200}>
          <Menu.Target>
            <ActionIcon variant="gradient" size={44} radius={16} aria-label="Add">
              <IconPlus size={22} stroke={2.6} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconChecklist size={16} />} onClick={() => useUi.setState({ todoEdit: { date: today } })}>
              To-do
            </Menu.Item>
            <Menu.Item leftSection={<IconCalendarPlus size={16} />} onClick={() => setEvent({ date: today, color: 'violet' })}>
              Event
            </Menu.Item>
            <Menu.Item leftSection={<IconCake size={16} />} onClick={() => setBirthday({})}>
              Birthday
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => setListsOpen(true)}>
              To-do lists
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <SegmentedControl
        fullWidth
        size="md"
        value={tab}
        onChange={(v) => useUi.setState({ planTab: v })}
        data={[
          { value: 'tasks', label: `To-dos${due ? ` · ${due}` : ''}` },
          { value: 'calendar', label: 'Calendar' },
          { value: 'birthdays', label: 'Birthdays' },
        ]}
      />

      {tab === 'tasks' && <Tasks onLists={() => setListsOpen(true)} />}
      {tab === 'calendar' && <CalendarView onEvent={setEvent} />}
      {tab === 'birthdays' && <Birthdays onEdit={setBirthday} />}

      <EventSheet draft={event} onClose={() => setEvent(null)} />
      <BirthdaySheet draft={birthday} onClose={() => setBirthday(null)} />
      <ListsSheet opened={listsOpen} onClose={() => setListsOpen(false)} />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// To-dos
// ---------------------------------------------------------------------------

function TodoGroup({ title, todos, today, tone, showDate, collapsed, emoji }: { title: string; todos: Todo[]; today: DateKey; tone?: string; showDate?: boolean; collapsed?: boolean; emoji: string }) {
  const [open, setOpen] = useState(!collapsed);
  if (!todos.length) return null;
  return (
    <Card p="sm" px="md" style={tone ? { borderColor: `color-mix(in srgb, var(--mantine-color-${tone}-5) 40%, transparent)` } : undefined}>
      <UnstyledButton onClick={() => setOpen(!open)} w="100%">
        <Group justify="space-between" py={4}>
          <Group gap={8}>
            <Text fz={16}>{emoji}</Text>
            <Text fw={800} fz={15} c={tone ? `var(--mantine-color-${tone}-4)` : undefined}>
              {title}
            </Text>
            <Text fw={800} fz={13} c="dimmed" className="num">
              {todos.length}
            </Text>
          </Group>
          <IconChevronDown size={16} style={{ opacity: 0.45, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
        </Group>
      </UnstyledButton>
      {open && (
        <div>
          {todos.map((t) => (
            <TodoRow key={t.id} todo={t} today={today} showDate={showDate} />
          ))}
        </div>
      )}
    </Card>
  );
}

function Tasks({ onLists }: { onLists: () => void }) {
  const today = useToday();
  const todos = useApp((s) => s.todos);
  const lists = useApp((s) => todoListsFor(s.settings));
  const [list, setList] = useState<string | null>(null);
  const g = groupTodos(todos, today, list);
  const open = Object.values(todos).filter((t) => !t.doneOn);
  const count = (id: string | null) => (id == null ? open.length : open.filter((t) => (id === '' ? !t.list : t.list === id)).length);
  const nothing = !g.overdue.length && !g.today.length && !g.tomorrow.length && !g.week.length && !g.later.length && !g.someday.length;
  const current = lists.find((l) => l.id === list);

  return (
    <Stack gap={12}>
      <QuickAdd today={today} list={list || null} placeholder={current ? `Add to ${current.name}…` : 'Add a to-do… try "dentist fri 3pm"'} />

      <div className="chip-row bleed">
        <Tap className="chip" data-active={list == null || undefined} onClick={() => setList(null)}>
          All <span className="num" style={{ opacity: 0.6 }}>{count(null)}</span>
        </Tap>
        {lists.map((l) => (
          <Tap key={l.id} className="chip" data-active={list === l.id || undefined} onClick={() => setList(list === l.id ? null : l.id)}>
            {l.emoji} {l.name}
            {count(l.id) > 0 && (
              <span className="num" style={{ opacity: 0.6 }}>
                {count(l.id)}
              </span>
            )}
          </Tap>
        ))}
        <Tap className="chip" onClick={onLists} aria-label="Edit lists" style={{ borderStyle: 'dashed', borderColor: 'var(--line-strong)' }}>
          ✏️ Lists
        </Tap>
      </div>

      <TodoGroup emoji="↪️" title="Overdue" todos={g.overdue} today={today} tone="orange" showDate />
      <TodoGroup emoji="📌" title="Today" todos={g.today} today={today} />
      <TodoGroup emoji="🌅" title="Tomorrow" todos={g.tomorrow} today={today} />
      <TodoGroup emoji="🗓️" title="Next 7 days" todos={g.week} today={today} showDate />
      <TodoGroup emoji="🔭" title="Later" todos={g.later} today={today} showDate />
      <TodoGroup emoji="💭" title="Someday" todos={g.someday} today={today} />
      {nothing && (
        <Card p="lg" ta="center">
          <Text fz={36}>🙌</Text>
          <Text fw={800} mt={4}>
            {list ? `Nothing in ${current?.name ?? 'this list'}` : 'Nothing on your list'}
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            Type it how you'd say it: "call the bank tomorrow 9am", "haircut every 2 weeks", "new headphones someday".
          </Text>
        </Card>
      )}
      <TodoGroup emoji="✅" title="Done this week" todos={g.done} today={today} collapsed />
      <Text size="xs" c="dimmed" ta="center">
        Anything not done on its day carries over to today until you tick it off. Someday ones wait quietly.
      </Text>
    </Stack>
  );
}

/** Rename, add or remove your to-do lists. */
function ListsSheet({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const settings = useApp((s) => s.settings);
  const todos = useApp((s) => s.todos);
  const lists = todoListsFor(settings);
  const save = (next: TodoList[]) => updateSettings({ todoLists: next });
  const [adding, setAdding] = useState({ emoji: '📌', name: '' });
  return (
    <Sheet opened={opened} onClose={onClose} title="To-do lists">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Sort to-dos into lists, then filter Plan by them. Type <b>#name</b> when adding (e.g. "pay rent #admin") to put it straight in one.
        </Text>
        {lists.map((l, i) => {
          const n = Object.values(todos).filter((t) => t.list === l.id && !t.doneOn).length;
          return (
            <Group key={l.id} gap="xs" wrap="nowrap">
              <TextInput w={60} defaultValue={l.emoji} maxLength={4} onBlur={(e) => e.currentTarget.value.trim() && save(lists.map((x, j) => (j === i ? { ...x, emoji: e.currentTarget.value.trim() } : x)))} aria-label="Emoji" />
              <TextInput style={{ flex: 1 }} defaultValue={l.name} onBlur={(e) => e.currentTarget.value.trim() && save(lists.map((x, j) => (j === i ? { ...x, name: e.currentTarget.value.trim() } : x)))} aria-label="Name" />
              <ActionIcon
                variant="subtle"
                color="red"
                size="lg"
                aria-label={`Delete ${l.name}`}
                onClick={() =>
                  confirmDelete(`the "${l.name}" list${n ? ` (its ${n} to-do${n === 1 ? '' : 's'} stay, just without a list)` : ''}`, () => {
                    for (const t of Object.values(todos)) if (t.list === l.id) upsert('todos', { ...t, list: null });
                    save(lists.filter((x) => x.id !== l.id));
                  })
                }
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          );
        })}
        <Group gap="xs" wrap="nowrap" mt="xs">
          <TextInput w={60} value={adding.emoji} onChange={(e) => setAdding({ ...adding, emoji: e.currentTarget.value })} maxLength={4} aria-label="New list emoji" />
          <TextInput style={{ flex: 1 }} placeholder="New list…" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.currentTarget.value })} aria-label="New list name" />
          <Button
            disabled={!adding.name.trim()}
            onClick={() => {
              save([...lists, { id: newId(), name: adding.name.trim(), emoji: adding.emoji.trim() || '📌' }]);
              setAdding({ emoji: '📌', name: '' });
            }}
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** Things on a day: birthdays, events, to-dos, and bigger jobs due. */
function DayAgenda({ date, summary, onEvent }: { date: DateKey; summary: Summary; onEvent: (e: Partial<CalEvent>) => void }) {
  const today = useToday();
  const events = useApp((s) => s.events);
  const birthdays = useApp((s) => s.birthdays);
  const todos = useApp((s) => s.todos);
  const e = summary.evalByDate[date];
  const g = grade(e?.pct ?? null);
  const dayEvents = eventsOn(events, date);
  const dayBirthdays = birthdaysOn(birthdays, date);
  const dayTodos = todosOn(todos, date, today);
  // Jobs on their schedule (the weekly and every-few-days ones; daily room jobs would just be noise)
  const jobs = summary.habits.filter((h) => h.kind === 'chore' && !(h.schedule && 'every' in h.schedule && h.schedule.every === 1) && summary.tracks[h.id]?.nextDue === date && date > today);
  const empty = !dayEvents.length && !dayBirthdays.length && !dayTodos.length && !jobs.length;

  return (
    <Card p="md">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={850} fz={17}>
            {fmt(date, 'dddd D MMMM')}
          </Text>
          <Text size="xs" c="dimmed" fw={600}>
            {relativeDay(date, today)}
          </Text>
        </div>
        {e && (
          <Text fw={850} fz={14} c={e.closed || !isOpen(e.date, today) ? `var(--mantine-color-${g.color}-4)` : 'dimmed'} className="num">
            {e.dayOff ? '🏖️ Day off' : e.closed || !isOpen(e.date, today) ? `${g.letter} · ${e.pct}%` : `${e.completed}/${e.required} so far`}
          </Text>
        )}
      </Group>

      <Stack gap={0} mt="sm">
        {dayBirthdays.map((b) => (
          <div key={b.id} className="hrow">
            <div className="hrow-main">
              <Tile emoji="🎂" color="pink" />
              <div className="hrow-label">{b.name}'s birthday</div>
            </div>
          </div>
        ))}
        {dayEvents.map((ev) => (
          <div key={ev.id} className="hrow">
            <Tap onClick={() => onEvent(ev)} aria-label={`Edit ${ev.title}`}>
              <div className="hrow-main">
                <ColorSwatch color={`var(--mantine-color-${ev.color ?? 'violet'}-6)`} size={14} withShadow={false} style={{ marginLeft: 11, marginRight: 11 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hrow-label">{ev.title}</div>
                  <Meta>
                    {ev.time && <M tone="accent">{timeLabel(ev.time)}</M>}
                    {ev.notes && <M>{ev.notes}</M>}
                  </Meta>
                </div>
              </div>
            </Tap>
          </div>
        ))}
        {dayTodos.map((t) => (
          <TodoRow key={t.id} todo={t} today={today} />
        ))}
        {jobs.map((h) => (
          <div key={h.id} className="hrow">
            <div className="hrow-main">
              <Tile emoji={h.emoji} color="grape" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="hrow-label">{h.label}</div>
                <Meta>
                  <M>due</M>
                </Meta>
              </div>
              <Button size="compact-sm" variant="light" onClick={() => setDone(today, h, true)}>
                Do early
              </Button>
            </div>
          </div>
        ))}
        {empty && (
          <Text size="sm" c="dimmed" py="xs">
            Nothing planned.
          </Text>
        )}
      </Stack>

      <Group mt="md" grow gap="xs">
        <Button leftSection={<IconCalendarPlus size={16} />} variant="light" px="xs" onClick={() => onEvent({ date, color: 'violet' })}>
          Event
        </Button>
        <Button leftSection={<IconChecklist size={16} />} variant="light" color="blue" px="xs" onClick={() => useUi.setState({ todoEdit: { date: maxKey(date, today) } })}>
          To-do
        </Button>
        {e && date <= today && (
          <Button variant="default" px="xs" onClick={() => openDay(date === today ? null : date)}>
            Day log
          </Button>
        )}
      </Group>
    </Card>
  );
}

/** The week ahead in one list: events, to-dos, birthdays and bigger jobs. */
function NextDays({ summary }: { summary: Summary }) {
  const today = useToday();
  const events = useApp((s) => s.events);
  const birthdays = useApp((s) => s.birthdays);
  const todos = useApp((s) => s.todos);
  const days = range(addDays(today, 1), addDays(today, 7));
  const bdays = upcomingBirthdays(birthdays, today, 14).filter((b) => b.daysAway > 0);
  const rows: { date: DateKey; node: ReactNode; key: string }[] = [];
  for (const d of days) {
    for (const ev of eventsBetween(events, d, d)) rows.push({ date: d, key: `e${ev.id}`, node: `${ev.time ? `${timeLabel(ev.time)} · ` : ''}${ev.title}` });
    for (const t of Object.values(todos).filter((x) => !x.doneOn && x.date === d)) rows.push({ date: d, key: `t${t.id}`, node: `📝 ${t.title}` });
    for (const h of summary.habits.filter((x) => x.kind === 'chore' && !(x.schedule && 'every' in x.schedule && x.schedule.every === 1) && summary.tracks[x.id]?.nextDue === d)) rows.push({ date: d, key: `h${h.id}`, node: `${h.emoji} ${h.label}` });
  }
  for (const b of bdays) rows.push({ date: b.date, key: `b${b.birthday.id}`, node: `🎂 ${b.birthday.name}${b.turning ? ` turns ${b.turning}` : ''}` });
  rows.sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return null;
  return (
    <Card p="md">
      <Text fw={850} fz={16} mb={4}>
        🔭 Coming up
      </Text>
      {rows.map((r, i) => (
        <Group key={r.key} justify="space-between" wrap="nowrap" py={7} style={i ? { borderTop: '1px solid var(--line)' } : undefined}>
          <Text size="sm" fw={600} truncate>
            {r.node}
          </Text>
          <Text size="xs" c="dimmed" fw={700} style={{ flexShrink: 0 }}>
            {diffDays(r.date, today) < 7 ? dayLabel(r.date, today) : fmt(r.date, 'ddd D MMM')}
          </Text>
        </Group>
      ))}
    </Card>
  );
}

function CalendarView({ onEvent }: { onEvent: (e: Partial<CalEvent>) => void }) {
  const today = useToday();
  const summary = useSummary();
  const events = useApp((s) => s.events);
  const birthdays = useApp((s) => s.birthdays);
  const todos = useApp((s) => s.todos);
  const [selected, setSelected] = useState<DateKey>(today);
  const scheme = useComputedColorScheme('dark');

  return (
    <Stack gap={12}>
      <Card p="xs">
        <Calendar
          fullWidth
          size="md"
          highlightToday
          weekendDays={[]}
          getDayProps={(d) => ({ selected: d === selected, onClick: () => setSelected(d) })}
          renderDay={(d) => {
            const pct = summary.evalByDate[d]?.pct;
            const dayNum = Number(d.slice(8));
            const colors = pct == null || d === selected ? null : scoreColor(pct, scheme);
            const dots = [
              eventsOn(events, d).length > 0 && 'violet',
              todosOn(todos, d, today).some((t) => !t.doneOn) && 'blue',
              birthdaysOn(birthdays, d).length > 0 && 'pink',
            ].filter(Boolean);
            return (
              <div
                style={{
                  position: 'relative',
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  display: 'grid',
                  placeItems: 'center',
                  background: colors?.bg,
                  color: colors?.fg,
                  fontWeight: colors ? 750 : undefined,
                }}
              >
                {dayNum}
                {dots.length > 0 && (
                  <div style={{ position: 'absolute', bottom: -6, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2 }}>
                    {dots.map((c) => (
                      <span key={c as string} style={{ width: 5, height: 5, borderRadius: 5, background: `var(--mantine-color-${c}-5)` }} />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />
        <Group gap="md" justify="center" mt={6} mb={4}>
          {[
            ['violet', 'Events'],
            ['blue', 'To-dos'],
            ['pink', 'Birthdays'],
          ].map(([c, l]) => (
            <Group key={c} gap={5}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: `var(--mantine-color-${c}-5)` }} />
              <Text size="xs" c="dimmed" fw={600}>
                {l}
              </Text>
            </Group>
          ))}
          <Group gap={5}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: scoreColor(80, scheme).bg }} />
            <Text size="xs" c="dimmed" fw={600}>
              Your score
            </Text>
          </Group>
        </Group>
      </Card>

      <DayAgenda date={selected} summary={summary} onEvent={onEvent} />
      <NextDays summary={summary} />
    </Stack>
  );
}

function EventSheet({ draft: initial, onClose }: { draft: EventDraft; onClose: () => void }) {
  const [draft, setDraft] = useState<Partial<CalEvent>>({});
  const [last, setLast] = useState<EventDraft>(null);
  if (last !== initial) {
    setLast(initial);
    setDraft(initial ?? {});
  }
  const valid = !!draft.title?.trim() && !!draft.date;
  const existing = !!initial?.id;

  return (
    <Sheet opened={!!initial} onClose={onClose} title={existing ? 'Edit event' : 'New event'}>
      <Stack>
        <TextInput label="What" placeholder="Dentist, night out, exam…" data-autofocus size="md" value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })} />
        <Group grow>
          <DatePickerInput label="Date" valueFormat="ddd D MMM YYYY" value={draft.date ?? null} onChange={(d) => setDraft({ ...draft, date: d ?? undefined })} />
          <TimeInput label="Time (optional)" value={draft.time ?? ''} onChange={(e) => setDraft({ ...draft, time: e.currentTarget.value })} />
        </Group>
        <Textarea label="Notes" autosize minRows={2} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.currentTarget.value })} />
        <div>
          <Text size="sm" fw={600} mb={6}>
            Colour
          </Text>
          <Group gap={10}>
            {EVENT_COLORS.map((c) => (
              <ColorSwatch
                key={c}
                component="button"
                type="button"
                aria-label={c}
                color={`var(--mantine-color-${c}-6)`}
                onClick={() => setDraft({ ...draft, color: c })}
                style={{ outline: (draft.color ?? 'violet') === c ? '2px solid var(--mantine-color-text)' : undefined, outlineOffset: 2, cursor: 'pointer' }}
              />
            ))}
          </Group>
        </div>
        <Group grow mt="xs">
          {existing && (
            <Button
              variant="light"
              color="red"
              onClick={() =>
                confirmDelete(draft.title ?? 'this event', () => {
                  removeItem('events', initial!.id!);
                  onClose();
                })
              }
            >
              Delete
            </Button>
          )}
          <Button
            variant="gradient"
            disabled={!valid}
            onClick={() => {
              upsert('events', {
                id: draft.id ?? newId(),
                title: draft.title!.trim(),
                date: draft.date!,
                time: draft.time || undefined,
                notes: draft.notes || undefined,
                color: draft.color ?? 'violet',
                createdAt: draft.createdAt ?? Date.now(),
              });
              onClose();
            }}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Birthdays
// ---------------------------------------------------------------------------

function Birthdays({ onEdit }: { onEdit: (b: Partial<Birthday>) => void }) {
  const today = useToday();
  const birthdays = useApp((s) => s.birthdays);
  const list = upcomingBirthdays(birthdays, today);
  const todays = list.filter((u) => u.daysAway === 0);
  return (
    <Stack gap={12}>
      {todays.map((u) => (
        <Notice key={u.birthday.id} emoji="🎉" color="pink" title={`It's ${u.birthday.name}'s birthday today${u.turning ? ` — ${u.turning}!` : ''}`} sub="Send a message!" />
      ))}
      <Button leftSection={<IconCake size={18} />} variant="gradient" size="md" onClick={() => onEdit({})}>
        Add a birthday
      </Button>
      {list.length > 0 ? (
        <Card p="sm" px="md">
          {list.map((u) => (
            <div key={u.birthday.id} className="hrow" style={accent('pink')}>
              <Tap onClick={() => onEdit(u.birthday)} aria-label={`Edit ${u.birthday.name}`}>
                <div className="hrow-main">
                  <Tile emoji={u.daysAway === 0 ? '🎉' : '🎂'} color="pink" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hrow-label">{u.birthday.name}</div>
                    <Meta>
                      <M>{fmt(u.date, 'D MMMM')}</M>
                      {u.turning && <M>turns {u.turning}</M>}
                    </Meta>
                  </div>
                  <Text size="sm" fw={800} c={u.daysAway <= 7 ? 'var(--accent-text)' : 'dimmed'} className="num">
                    {u.daysAway === 0 ? 'Today!' : u.daysAway === 1 ? 'Tomorrow' : `${u.daysAway} days`}
                  </Text>
                </div>
              </Tap>
            </div>
          ))}
        </Card>
      ) : (
        <Text c="dimmed" size="sm" ta="center">
          No birthdays yet — add your friends and they'll show up on the calendar and on Today.
        </Text>
      )}
    </Stack>
  );
}

function BirthdaySheet({ draft: initial, onClose }: { draft: BirthdayDraft; onClose: () => void }) {
  const [draft, setDraft] = useState<Partial<Birthday>>({});
  const [last, setLast] = useState<BirthdayDraft>(null);
  if (last !== initial) {
    setLast(initial);
    setDraft(initial ?? {});
  }
  const valid = !!draft.name?.trim() && !!draft.month && !!draft.day;
  const existing = !!initial?.id;

  return (
    <Sheet opened={!!initial} onClose={onClose} title={existing ? 'Edit birthday' : 'Add a birthday'}>
      <Stack>
        <TextInput label="Name" data-autofocus size="md" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })} />
        <Group grow>
          <NumberInput label="Day" min={1} max={31} value={draft.day ?? ''} onChange={(v) => setDraft({ ...draft, day: Number(v) || undefined })} />
          <Select
            label="Month"
            data={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
            value={draft.month ? String(draft.month) : null}
            onChange={(v) => setDraft({ ...draft, month: v ? Number(v) : undefined })}
          />
        </Group>
        <NumberInput label="Year born (optional)" description="Shows how old they're turning" min={1900} max={2100} value={draft.year ?? ''} onChange={(v) => setDraft({ ...draft, year: Number(v) || null })} />
        <Group grow mt="xs">
          {existing && (
            <Button
              variant="light"
              color="red"
              onClick={() =>
                confirmDelete(`${draft.name}'s birthday`, () => {
                  removeItem('birthdays', initial!.id!);
                  onClose();
                })
              }
            >
              Delete
            </Button>
          )}
          <Button
            variant="gradient"
            disabled={!valid}
            onClick={() => {
              upsert('birthdays', { id: draft.id ?? newId(), name: draft.name!.trim(), day: draft.day!, month: draft.month!, year: draft.year ?? null });
              onClose();
            }}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Sheet>
  );
}
