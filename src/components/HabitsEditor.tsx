import { ActionIcon, Button, Group, NumberInput, SegmentedControl, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowsSort, IconChevronDown, IconChevronRight, IconChevronUp, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { addHabit, moveHabit, setHabitOn } from '../lib/actions';
import { SECTIONS, WEEKDAYS, allHabits, scheduleLabel, type Habit, type HabitKind, type SectionId } from '../lib/config';
import { dateKey } from '../lib/dates';
import { everyOn } from '../lib/engine';
import { openHabit, useUi } from '../lib/hooks';
import { useApp } from '../lib/store';
import type { Settings } from '../lib/types';
import { Sheet, Tap, Tile, accent } from './ui';

/** One line about how a habit works: "every 3 days · 10 XP", "Saturdays · 20 XP", "bonus · 20 XP". */
function describe(h: Habit, settings: Settings): string {
  const bits: string[] = [];
  if (h.kind === 'chore' && h.schedule) bits.push(scheduleLabel(h.schedule));
  else if (h.kind === 'avoid') bits.push(h.weeklyLimit ? `stay clean · ${h.weeklyLimit} a week allowed` : 'stay clean');
  else if (h.kind === 'time') bits.push('yes / no');
  else {
    const every = everyOn(settings, h.id, dateKey());
    bits.push(every > 1 ? scheduleLabel({ every }) : 'daily');
  }
  if (h.kind === 'count') bits.push(`to ${h.target ?? 1}${h.unit ? ` ${h.unit}` : ''}`);
  if (h.kind === 'water') bits.push(`${h.target ?? 2} bottles`);
  if (h.restDays?.length) bits.push(`not ${h.restDays.map((d) => WEEKDAYS[d].slice(0, 3)).join('/')}`);
  if (h.optional) bits.push('bonus');
  bits.push(`${h.points} XP`);
  return bits.join(' · ');
}

/** All your habits by part of the day: switch on/off, reorder, tap one to change anything about it. */
export default function HabitsEditor() {
  const settings = useApp((s) => s.settings);
  const [reorder, setReorder] = useState(false);
  const all = allHabits(settings);
  const hidden = new Set(settings.hiddenHabits ?? []);

  return (
    <Stack gap="lg">
      <Group grow>
        <Button leftSection={<IconPlus size={16} stroke={2.6} />} variant="gradient" onClick={() => useUi.setState({ addHabit: true })}>
          Add a habit
        </Button>
        <Button variant={reorder ? 'filled' : 'default'} leftSection={<IconArrowsSort size={16} />} onClick={() => setReorder(!reorder)}>
          {reorder ? 'Done' : 'Reorder'}
        </Button>
      </Group>
      <Text size="xs" c="dimmed" mt={-8}>
        Tap a habit to change its name, emoji, part of the day, XP, how often, rest days and more. Switching one off hides it — its history stays.
      </Text>

      {SECTIONS.map((sec) => {
        const list = all.filter((h) => h.section === sec.id);
        if (!list.length) return null;
        const on = list.filter((h) => !hidden.has(h.id)).length;
        return (
          <div key={sec.id}>
            <div className="eyebrow group-label">
              {sec.emoji} {sec.title} · {on}
            </div>
            <div className="group">
              {list.map((h, i) => {
                const tracked = !hidden.has(h.id);
                return (
                  <div key={h.id} className="menu-row" style={{ ...accent(sec.color), opacity: tracked ? 1 : 0.55, cursor: 'default' }}>
                    <Tile emoji={h.emoji} color={sec.color} size={34} dim={!tracked} />
                    <Tap onClick={() => openHabit(h.id)} style={{ flex: 1, minWidth: 0 }} aria-label={`Edit ${h.label}`}>
                      <Text fw={700} size="sm" truncate>
                        {h.label}
                        {h.custom && (
                          <Text span size="xs" c="dimmed" fw={600}>
                            {' '}
                            · yours
                          </Text>
                        )}
                      </Text>
                      <Text size="xs" c="dimmed" fw={550} truncate>
                        {tracked ? describe(h, settings) : 'switched off'}
                      </Text>
                    </Tap>
                    {reorder ? (
                      <Group gap={2} wrap="nowrap">
                        <ActionIcon variant="subtle" color="gray" disabled={i === 0} onClick={() => moveHabit(h.id, -1)} aria-label={`Move ${h.label} up`}>
                          <IconChevronUp size={18} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="gray" disabled={i === list.length - 1} onClick={() => moveHabit(h.id, 1)} aria-label={`Move ${h.label} down`}>
                          <IconChevronDown size={18} />
                        </ActionIcon>
                      </Group>
                    ) : (
                      <Group gap={6} wrap="nowrap">
                        <Switch size="md" checked={tracked} onChange={(e) => setHabitOn(h.id, e.currentTarget.checked)} color="teal" aria-label={`Track ${h.label}`} />
                        <IconChevronRight size={16} style={{ opacity: 0.35 }} />
                      </Group>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Stack>
  );
}

type NewKind = Extract<HabitKind, 'check' | 'count' | 'avoid' | 'chore'>;
const KINDS: { value: NewKind; label: string; detail: string }[] = [
  { value: 'check', label: 'Tick', detail: 'Something to do — every day, or every few days (change it after adding).' },
  { value: 'count', label: 'Count', detail: 'Count up to a target: pages, minutes, glasses, push-ups…' },
  { value: 'avoid', label: 'Stay clean', detail: "Something you're cutting out — answered Clean / Slipped each day." },
  { value: 'chore', label: 'Job', detail: 'A job on a schedule that carries over until done. (For one-offs like a haircut, a repeating to-do is better.)' },
];

/** Make your own habit. */
export function AddHabitSheet() {
  const opened = useUi((s) => s.addHabit);
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [kind, setKind] = useState<NewKind>('check');
  const [section, setSection] = useState<SectionId>('day');
  const [repeat, setRepeat] = useState<'every' | 'weekday'>('every');
  const [every, setEvery] = useState(2);
  const [wd, setWd] = useState(6);
  const [points, setPoints] = useState(10);
  const [target, setTarget] = useState(10);
  const [unit, setUnit] = useState('');
  const [optional, setOptional] = useState(false);
  const close = () => useUi.setState({ addHabit: false });

  const save = () => {
    const h = addHabit({
      label: label.trim(),
      emoji: emoji.trim() || '✨',
      section: kind === 'avoid' ? 'clean' : section,
      kind,
      points,
      ...(kind === 'chore' ? { schedule: repeat === 'every' ? { every } : { weekday: wd } } : {}),
      ...(kind === 'count' ? { target: Math.max(1, target), unit: unit.trim() || undefined } : {}),
      ...(optional && (kind === 'check' || kind === 'count') ? { optional: true } : {}),
    });
    notifications.show({ color: 'teal', title: `${h.emoji} ${h.label} added`, message: "It's on Today from now on. Tap it in the list to fine-tune it." });
    setLabel('');
    close();
  };

  return (
    <Sheet opened={opened} onClose={close} title="Add a habit" zIndex={320}>
      <Stack gap="md">
        <Group align="flex-end" wrap="nowrap" gap="xs">
          <TextInput label="Emoji" w={72} value={emoji} onChange={(e) => setEmoji(e.currentTarget.value)} maxLength={4} />
          <TextInput label="Habit" placeholder="Read, stretch, no sugar…" style={{ flex: 1 }} value={label} onChange={(e) => setLabel(e.currentTarget.value)} data-autofocus />
        </Group>
        <div>
          <SegmentedControl fullWidth value={kind} onChange={(v) => setKind(v as NewKind)} data={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
          <Text size="xs" c="dimmed" mt={6}>
            {KINDS.find((k) => k.value === kind)!.detail}
          </Text>
        </div>
        {kind === 'count' && (
          <Group grow>
            <NumberInput label="Target" min={1} max={500} value={target} onChange={(v) => setTarget(Number(v) || 1)} />
            <TextInput label="Unit" placeholder="pages, mins…" value={unit} onChange={(e) => setUnit(e.currentTarget.value)} />
          </Group>
        )}
        {kind === 'chore' && (
          <Group grow align="flex-end">
            <SegmentedControl
              value={repeat}
              onChange={(v) => setRepeat(v as typeof repeat)}
              data={[
                { value: 'every', label: 'Every N days' },
                { value: 'weekday', label: 'Weekly' },
              ]}
            />
            {repeat === 'every' ? (
              <NumberInput min={1} max={60} value={every} onChange={(v) => setEvery(Number(v) || 1)} suffix=" days" aria-label="Every how many days" />
            ) : (
              <Select data={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} value={String(wd)} onChange={(v) => setWd(Number(v ?? 0))} allowDeselect={false} aria-label="Day" />
            )}
          </Group>
        )}
        {kind !== 'avoid' && (
          <div>
            <Text size="sm" fw={650} mb={6}>
              Part of the day
            </Text>
            <div className="chip-row" style={{ flexWrap: 'wrap' }}>
              {SECTIONS.filter((s) => s.id !== 'clean').map((s) => (
                <Tap key={s.id} className="chip" data-active={section === s.id || undefined} style={accent(s.color)} onClick={() => setSection(s.id)}>
                  {s.emoji} {s.short}
                </Tap>
              ))}
            </div>
          </div>
        )}
        <div>
          <Text size="sm" fw={650} mb={6}>
            XP
          </Text>
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
            {[5, 10, 15, 20, 25, 30].map((p) => (
              <Tap key={p} className="chip" data-active={points === p || undefined} onClick={() => setPoints(p)}>
                {p}
              </Tap>
            ))}
          </div>
        </div>
        {(kind === 'check' || kind === 'count') && (
          <Switch color="teal" checked={optional} onChange={(e) => setOptional(e.currentTarget.checked)} label="Bonus" description="XP when you do it, never counted against you" />
        )}
        <Button size="md" variant="gradient" disabled={!label.trim()} onClick={save}>
          Add habit
        </Button>
      </Stack>
    </Sheet>
  );
}
