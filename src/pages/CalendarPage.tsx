import {
  ActionIcon,
  Badge,
  Button,
  Card,
  ColorSwatch,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  useComputedColorScheme,
} from '@mantine/core';
import { Calendar, DatePickerInput, TimeInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconCake, IconChecklist, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { Fragment, useState } from 'react';
import { TodoModal, TodoRow } from '../components/Todos';
import { EVENT_COLORS, birthdaysOn, eventsOn, upcomingBirthdays } from '../lib/calendar';
import { fmt, maxKey, relativeDay, type DateKey } from '../lib/dates';
import { grade, isOpen } from '../lib/engine';
import { scoreColor } from '../lib/scoreColors';
import { openDay, useSummary, useToday } from '../lib/hooks';
import { newId, removeItem, upsert, useApp } from '../lib/store';
import { openTodos, todosOn, upcomingTodos } from '../lib/todos';
import type { Birthday, CalEvent, Todo } from '../lib/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function EventModal({ opened, onClose, initial }: { opened: boolean; onClose: () => void; initial: Partial<CalEvent> }) {
  const [draft, setDraft] = useState<Partial<CalEvent>>(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setDraft(initial);
  }
  const valid = !!draft.title?.trim() && !!draft.date;

  return (
    <Modal opened={opened} onClose={onClose} title={draft.id ? 'Edit event' : 'New event'}>
      <Stack>
        <TextInput
          label="What"
          placeholder="Dentist, night out, exam…"
          data-autofocus
          value={draft.title ?? ''}
          onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })}
        />
        <Group grow>
          <DatePickerInput label="Date" value={draft.date ?? null} onChange={(d) => setDraft({ ...draft, date: d ?? undefined })} />
          <TimeInput label="Time (optional)" value={draft.time ?? ''} onChange={(e) => setDraft({ ...draft, time: e.currentTarget.value })} />
        </Group>
        <Textarea label="Notes" autosize minRows={2} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.currentTarget.value })} />
        <Group gap={8}>
          {EVENT_COLORS.map((c) => (
            <ColorSwatch
              key={c}
              component="button"
              color={`var(--mantine-color-${c}-6)`}
              onClick={() => setDraft({ ...draft, color: c })}
              style={{ outline: (draft.color ?? 'violet') === c ? '2px solid var(--mantine-color-text)' : undefined, outlineOffset: 2 }}
            />
          ))}
        </Group>
        <Button
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
      </Stack>
    </Modal>
  );
}

function BirthdayModal({ opened, onClose, initial }: { opened: boolean; onClose: () => void; initial: Partial<Birthday> }) {
  const [draft, setDraft] = useState<Partial<Birthday>>(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setDraft(initial);
  }
  const valid = !!draft.name?.trim() && !!draft.month && !!draft.day;

  return (
    <Modal opened={opened} onClose={onClose} title={draft.id ? 'Edit birthday' : 'Add a birthday'}>
      <Stack>
        <TextInput label="Name" data-autofocus value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })} />
        <Group grow>
          <NumberInput label="Day" min={1} max={31} value={draft.day ?? ''} onChange={(v) => setDraft({ ...draft, day: Number(v) || undefined })} />
          <Select
            label="Month"
            data={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
            value={draft.month ? String(draft.month) : null}
            onChange={(v) => setDraft({ ...draft, month: v ? Number(v) : undefined })}
          />
        </Group>
        <NumberInput
          label="Year born (optional)"
          description="Shows how old they're turning"
          min={1900}
          max={2100}
          value={draft.year ?? ''}
          onChange={(v) => setDraft({ ...draft, year: Number(v) || null })}
        />
        <Button
          disabled={!valid}
          onClick={() => {
            upsert('birthdays', { id: draft.id ?? newId(), name: draft.name!.trim(), day: draft.day!, month: draft.month!, year: draft.year ?? null });
            onClose();
          }}
        >
          Save
        </Button>
      </Stack>
    </Modal>
  );
}

function confirmDelete(what: string, onConfirm: () => void) {
  modals.openConfirmModal({
    title: `Delete ${what}?`,
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm,
  });
}

export default function CalendarPage() {
  const today = useToday();
  const summary = useSummary();
  const events = useApp((s) => s.events);
  const birthdays = useApp((s) => s.birthdays);
  const todos = useApp((s) => s.todos);
  const [selected, setSelected] = useState<DateKey>(today);
  const [eventOpen, eventModal] = useDisclosure(false);
  const [bdayOpen, bdayModal] = useDisclosure(false);
  const [eventDraft, setEventDraft] = useState<Partial<CalEvent>>({});
  const [bdayDraft, setBdayDraft] = useState<Partial<Birthday>>({});
  const [todoOpen, todoModal] = useDisclosure(false);
  const [todoDraft, setTodoDraft] = useState<Partial<Todo>>({});
  const scheme = useComputedColorScheme('dark');

  const dayEvents = eventsOn(events, selected);
  const dayBirthdays = birthdaysOn(birthdays, selected);
  const dayTodos = todosOn(todos, selected, today);
  const nowTodos = openTodos(todos, today);
  const laterTodos = upcomingTodos(todos, today, 3650);
  const e = summary.evalByDate[selected];
  const g = grade(e?.pct ?? null);

  const editEvent = (ev: Partial<CalEvent>) => {
    setEventDraft(ev);
    eventModal.open();
  };
  const editTodo = (t: Partial<Todo>) => {
    setTodoDraft(t);
    todoModal.open();
  };
  const editBirthday = (b: Partial<Birthday>) => {
    setBdayDraft(b);
    bdayModal.open();
  };

  return (
    <Stack>
      <Title order={2}>Calendar</Title>
      <Tabs defaultValue="calendar" variant="pills" radius="xl">
        <Tabs.List grow>
          <Tabs.Tab value="calendar" px={8} fz="sm">
            📅 Calendar
          </Tabs.Tab>
          <Tabs.Tab value="todos" px={8} fz="sm">
            📝 To-dos{nowTodos.length ? ` (${nowTodos.length})` : ''}
          </Tabs.Tab>
          <Tabs.Tab value="birthdays" px={8} fz="sm">
            🎂 Birthdays
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="calendar" pt="md">
          <Stack>
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
                    eventsOn(events, d).length > 0 && 'blue',
                    todosOn(todos, d, today).some((t) => !t.doneOn) && 'orange',
                    birthdaysOn(birthdays, d).length > 0 && 'pink',
                  ].filter(Boolean);
                  return (
                    <div
                      style={{
                        position: 'relative',
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        display: 'grid',
                        placeItems: 'center',
                        background: colors?.bg,
                        color: colors?.fg,
                        fontWeight: colors ? 700 : undefined,
                      }}
                    >
                      {dayNum}
                      {dots.length > 0 && (
                        <div style={{ position: 'absolute', bottom: -5, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2 }}>
                          {dots.map((c) => (
                            <span key={c as string} style={{ width: 5, height: 5, borderRadius: 5, background: `var(--mantine-color-${c}-5)` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </Card>

            <Card>
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text fw={800}>{fmt(selected, 'dddd D MMMM')}</Text>
                  <Text size="xs" c="dimmed">
                    {relativeDay(selected, today)}
                  </Text>
                </div>
                {e && (
                  <Badge size="xl" color={e.closed || !isOpen(e.date, today) ? g.color : 'violet'} variant="light" tt="none">
                    {e.dayOff ? 'Day off' : e.closed || !isOpen(e.date, today) ? `${g.letter} · ${e.pct}%` : `${e.completed}/${e.required} so far`}
                  </Badge>
                )}
              </Group>

              <Stack gap="xs" mt="md">
                {dayBirthdays.map((b) => (
                  <Text key={b.id} fw={600}>
                    🎂 {b.name}'s birthday
                  </Text>
                ))}
                {dayEvents.map((ev) => (
                  <Group key={ev.id} justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <ColorSwatch color={`var(--mantine-color-${ev.color ?? 'violet'}-6)`} size={12} />
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={600} truncate>
                          {ev.time ? `${ev.time} · ` : ''}
                          {ev.title}
                        </Text>
                        {ev.notes && (
                          <Text size="xs" c="dimmed">
                            {ev.notes}
                          </Text>
                        )}
                      </div>
                    </Group>
                    <Group gap={2} wrap="nowrap">
                      <ActionIcon variant="subtle" color="gray" onClick={() => editEvent(ev)} aria-label="Edit">
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete(ev.title, () => removeItem('events', ev.id))} aria-label="Delete">
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                ))}
                {dayTodos.length > 0 && (
                  <div>
                    {dayTodos.map((t) => (
                      <TodoRow key={t.id} todo={t} today={today} onEdit={editTodo} />
                    ))}
                  </div>
                )}
                {!dayEvents.length && !dayBirthdays.length && !dayTodos.length && (
                  <Text size="sm" c="dimmed">
                    Nothing planned.
                  </Text>
                )}
              </Stack>

              <Group mt="md" grow gap="xs">
                <Button leftSection={<IconPlus size={16} />} variant="light" px="xs" onClick={() => editEvent({ date: selected, color: 'violet' })}>
                  Event
                </Button>
                <Button leftSection={<IconChecklist size={16} />} variant="light" color="orange" px="xs" onClick={() => editTodo({ date: maxKey(selected, today) })}>
                  To-do
                </Button>
                {selected <= today && selected >= summary.evals[0]?.date && (
                  <Button variant="default" px="xs" onClick={() => openDay(selected === today ? null : selected)}>
                    Day log
                  </Button>
                )}
              </Group>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="todos" pt="md">
          <Stack>
            <Button leftSection={<IconChecklist size={18} />} variant="gradient" onClick={() => editTodo({ date: today })}>
              Add a to-do
            </Button>
            <Card p="sm">
              <Text fw={800} fz={17} px={4}>
                Now
              </Text>
              {nowTodos.length ? (
                nowTodos.map((t) => <TodoRow key={t.id} todo={t} today={today} onEdit={editTodo} />)
              ) : (
                <Text size="sm" c="dimmed" px={4} py="xs">
                  Nothing due — you're on top of it. 🙌
                </Text>
              )}
            </Card>
            {laterTodos.length > 0 && (
              <Card p="sm">
                <Text fw={800} fz={17} px={4}>
                  Planned
                </Text>
                {laterTodos.map((t, i) => (
                  <Fragment key={t.id}>
                    {laterTodos[i - 1]?.date !== t.date && (
                      <Text size="xs" c="dimmed" fw={700} px={4} mt={6}>
                        {relativeDay(t.date, today)}
                      </Text>
                    )}
                    <TodoRow todo={t} today={today} onEdit={editTodo} />
                  </Fragment>
                ))}
              </Card>
            )}
            <Text size="xs" c="dimmed" ta="center">
              Anything not done on its day carries over to today until you tick it off.
            </Text>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="birthdays" pt="md">
          <Stack>
            <Button leftSection={<IconCake size={18} />} variant="gradient" onClick={() => editBirthday({})}>
              Add a birthday
            </Button>
            {upcomingBirthdays(birthdays, today).map((u) => (
              <Card key={u.birthday.id} p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text fw={700}>
                      {u.birthday.name}
                      {u.turning ? (
                        <Text span c="dimmed" size="sm">
                          {' '}
                          · turns {u.turning}
                        </Text>
                      ) : null}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {fmt(u.date, 'D MMMM')} · {u.daysAway === 0 ? 'today! 🎉' : u.daysAway === 1 ? 'tomorrow' : `in ${u.daysAway} days`}
                    </Text>
                  </div>
                  <Group gap={2} wrap="nowrap">
                    <ActionIcon variant="subtle" color="gray" onClick={() => editBirthday(u.birthday)} aria-label="Edit">
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => confirmDelete(`${u.birthday.name}'s birthday`, () => removeItem('birthdays', u.birthday.id))}
                      aria-label="Delete"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Card>
            ))}
            {!Object.keys(birthdays).length && (
              <Text c="dimmed" size="sm" ta="center">
                No birthdays yet — add your friends and they'll show up on the calendar and your Today page.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <EventModal opened={eventOpen} onClose={eventModal.close} initial={eventDraft} />
      <BirthdayModal opened={bdayOpen} onClose={bdayModal.close} initial={bdayDraft} />
      <TodoModal opened={todoOpen} onClose={todoModal.close} initial={todoDraft} />
    </Stack>
  );
}
