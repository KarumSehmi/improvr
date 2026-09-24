import {
  ActionIcon,
  Badge,
  Button,
  Card,
  ColorSwatch,
  Group,
  Indicator,
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
import { IconCake, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { EVENT_COLORS, birthdaysOn, eventsOn, upcomingBirthdays } from '../lib/calendar';
import { fmt, relativeDay, type DateKey } from '../lib/dates';
import { grade } from '../lib/engine';
import { scoreColor } from '../lib/scoreColors';
import { openDay, useSummary, useToday } from '../lib/hooks';
import { newId, removeItem, upsert, useApp } from '../lib/store';
import type { Birthday, CalEvent } from '../lib/types';

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
  const [selected, setSelected] = useState<DateKey>(today);
  const [eventOpen, eventModal] = useDisclosure(false);
  const [bdayOpen, bdayModal] = useDisclosure(false);
  const [eventDraft, setEventDraft] = useState<Partial<CalEvent>>({});
  const [bdayDraft, setBdayDraft] = useState<Partial<Birthday>>({});
  const scheme = useComputedColorScheme('dark');

  const dayEvents = eventsOn(events, selected);
  const dayBirthdays = birthdaysOn(birthdays, selected);
  const e = summary.evalByDate[selected];
  const g = grade(e?.pct ?? null);

  const editEvent = (ev: Partial<CalEvent>) => {
    setEventDraft(ev);
    eventModal.open();
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
          <Tabs.Tab value="calendar">📅 Calendar</Tabs.Tab>
          <Tabs.Tab value="birthdays">🎂 Birthdays ({Object.keys(birthdays).length})</Tabs.Tab>
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
                  const hasEvent = eventsOn(events, d).length > 0;
                  const hasBday = birthdaysOn(birthdays, d).length > 0;
                  const dayNum = Number(d.slice(8));
                  const colors = pct == null || d === selected ? null : scoreColor(pct, scheme);
                  return (
                    <Indicator
                      size={6}
                      color={hasBday ? 'pink' : 'blue'}
                      offset={-2}
                      disabled={!hasEvent && !hasBday}
                      position="bottom-center"
                    >
                      <div
                        style={{
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
                      </div>
                    </Indicator>
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
                  <Badge size="xl" color={g.color} variant="light">
                    {e.dayOff ? 'Day off' : `${g.letter} · ${e.pct}%`}
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
                {!dayEvents.length && !dayBirthdays.length && (
                  <Text size="sm" c="dimmed">
                    Nothing planned.
                  </Text>
                )}
              </Stack>

              <Group mt="md" grow>
                <Button leftSection={<IconPlus size={16} />} variant="light" onClick={() => editEvent({ date: selected, color: 'violet' })}>
                  Add event
                </Button>
                {selected <= today && selected >= summary.evals[0]?.date && (
                  <Button variant="default" onClick={() => openDay(selected === today ? null : selected)}>
                    Open day log
                  </Button>
                )}
              </Group>
            </Card>
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
    </Stack>
  );
}
