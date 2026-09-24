import { ActionIcon, Button, Card, Group, Modal, NumberInput, SegmentedControl, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { BUILT_IN_HABITS, SECTIONS, WEEKDAYS, scheduleLabel, type ChoreSchedule, type Habit, type SectionId } from '../lib/config';
import { dateKey } from '../lib/dates';
import { newId, updateSettings, useApp } from '../lib/store';
import { Tile } from './ui';

const WEEKDAY_OPTIONS = WEEKDAYS.map((d, i) => ({ value: String(i), label: d }));

function ScheduleControl({ schedule, onChange }: { schedule: ChoreSchedule; onChange: (s: ChoreSchedule) => void }) {
  if ('every' in schedule) {
    return (
      <NumberInput
        w={96}
        size="xs"
        min={1}
        max={60}
        prefix="every "
        suffix="d"
        value={schedule.every}
        onChange={(v) => Number(v) >= 1 && onChange({ ...schedule, every: Number(v) })}
        aria-label="Every how many days"
      />
    );
  }
  return (
    <Select
      w={126}
      size="xs"
      data={WEEKDAY_OPTIONS}
      value={String(schedule.weekday)}
      onChange={(v) => v != null && onChange({ ...schedule, weekday: Number(v) })}
      allowDeselect={false}
      aria-label="Day of the week"
    />
  );
}

function AddHabitModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const stored = useApp((s) => s.settings.customHabits);
  const custom = stored ?? [];
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [type, setType] = useState<'check' | 'avoid' | 'chore'>('check');
  const [section, setSection] = useState<SectionId>('day');
  const [repeat, setRepeat] = useState<'every' | 'weekday'>('every');
  const [every, setEvery] = useState(2);
  const [wd, setWd] = useState(0);
  const [points, setPoints] = useState('10');

  const save = () => {
    const habit: Habit = {
      id: `c_${newId()}`,
      label: label.trim(),
      emoji: emoji.trim() || '✨',
      section: type === 'avoid' ? 'clean' : section,
      kind: type,
      points: Number(points),
      since: dateKey(),
      ...(type === 'chore' ? { schedule: repeat === 'every' ? { every } : { weekday: wd } } : {}),
    };
    updateSettings({ customHabits: [...custom, habit] });
    setLabel('');
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={800}>Add a habit</Text>}>
      <Stack>
        <Group align="flex-end" wrap="nowrap">
          <TextInput label="Emoji" w={70} value={emoji} onChange={(e) => setEmoji(e.currentTarget.value)} maxLength={4} />
          <TextInput label="Habit" placeholder="Read 10 pages" style={{ flex: 1 }} value={label} onChange={(e) => setLabel(e.currentTarget.value)} data-autofocus />
        </Group>
        <SegmentedControl
          fullWidth
          value={type}
          onChange={(v) => setType(v as typeof type)}
          data={[
            { value: 'check', label: 'Daily tick' },
            { value: 'avoid', label: 'Stay clean' },
            { value: 'chore', label: 'Repeating job' },
          ]}
        />
        <Text size="xs" c="dimmed" mt={-8}>
          {type === 'check' ? 'Something to do every day.' : type === 'avoid' ? "Something you're cutting out — answered Clean / Slipped." : 'Comes round on a schedule and carries over until done.'}
        </Text>
        {type === 'chore' && (
          <Group grow align="flex-end">
            <SegmentedControl value={repeat} onChange={(v) => setRepeat(v as typeof repeat)} data={[{ value: 'every', label: 'Every N days' }, { value: 'weekday', label: 'Weekly' }]} />
            {repeat === 'every' ? (
              <NumberInput min={1} max={60} value={every} onChange={(v) => setEvery(Number(v) || 1)} suffix=" days" />
            ) : (
              <Select data={WEEKDAY_OPTIONS} value={String(wd)} onChange={(v) => setWd(Number(v ?? 0))} allowDeselect={false} />
            )}
          </Group>
        )}
        <Group grow>
          {type !== 'avoid' && (
            <Select
              label="Section"
              data={SECTIONS.filter((s) => s.id !== 'clean').map((s) => ({ value: s.id, label: `${s.emoji} ${s.title}` }))}
              value={section}
              onChange={(v) => v && setSection(v as SectionId)}
              allowDeselect={false}
            />
          )}
          <Select label="XP" data={['5', '10', '15', '20', '25']} value={points} onChange={(v) => v && setPoints(v)} allowDeselect={false} />
        </Group>
        <Button variant="gradient" disabled={!label.trim()} onClick={save}>
          Add habit
        </Button>
      </Stack>
    </Modal>
  );
}

export default function HabitsEditor() {
  const settings = useApp((s) => s.settings);
  const [adding, setAdding] = useState(false);
  const hidden = new Set(settings.hiddenHabits ?? []);
  const overrides = settings.scheduleOverrides ?? {};
  const custom = settings.customHabits ?? [];
  const all: Habit[] = [...BUILT_IN_HABITS.map((h) => (overrides[h.id] ? { ...h, schedule: overrides[h.id] } : h)), ...custom.map((h) => ({ ...h, custom: true }))];

  const toggle = (id: string, on: boolean) => {
    const next = new Set(hidden);
    if (on) next.delete(id);
    else next.add(id);
    updateSettings({ hiddenHabits: [...next] });
  };
  const reschedule = (h: Habit, schedule: ChoreSchedule) => {
    if (h.custom) updateSettings({ customHabits: custom.map((c) => (c.id === h.id ? { ...c, schedule } : c)) });
    else updateSettings({ scheduleOverrides: { ...overrides, [h.id]: schedule } });
  };
  const remove = (h: Habit) =>
    modals.openConfirmModal({
      title: `Delete "${h.label}"?`,
      children: <Text size="sm">Its history stays in your old days but it won't show up any more. (Switching it off instead keeps it restorable.)</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => updateSettings({ customHabits: custom.filter((c) => c.id !== h.id) }),
    });

  return (
    <Card>
      <Group justify="space-between">
        <div>
          <Text fw={800} fz={17}>
            ✏️ Your habits
          </Text>
          <Text size="xs" c="dimmed">
            Switch things off, move chore days, add your own
          </Text>
        </div>
        <Button size="compact-sm" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setAdding(true)}>
          Add
        </Button>
      </Group>

      {SECTIONS.map((sec) => {
        const list = all.filter((h) => h.section === sec.id);
        if (!list.length) return null;
        return (
          <div key={sec.id} style={{ marginTop: 14 }}>
            <div className="eyebrow">
              {sec.emoji} {sec.title}
            </div>
            {list.map((h) => {
              const on = !hidden.has(h.id);
              return (
                <div key={h.id} className="hrow">
                  <div className="hrow-main" style={{ opacity: on ? 1 : 0.5 }}>
                    <Tile emoji={h.emoji} color={sec.color} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600} lh={1.25}>
                        {h.label}
                        {h.hint && !h.schedule && (
                          <Text span size="xs" c="dimmed">
                            {' '}
                            · {h.hint}
                          </Text>
                        )}
                      </Text>
                      {h.schedule && (
                        <Text size="xs" c="dimmed">
                          {scheduleLabel(h.schedule)}
                        </Text>
                      )}
                    </div>
                    {h.schedule && on && <ScheduleControl schedule={h.schedule} onChange={(s) => reschedule(h, s)} />}
                    {h.custom && (
                      <ActionIcon variant="subtle" color="red" onClick={() => remove(h)} aria-label="Delete">
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                    <Switch checked={on} onChange={(e) => toggle(h.id, e.currentTarget.checked)} color="teal" aria-label={`Track ${h.label}`} />
                  </div>
                  {h.kind === 'avoid' && on && (
                    <Group grow gap="xs" mt={8} pl={44}>
                      <NumberInput
                        size="xs"
                        label="It cost me / week"
                        prefix="£"
                        min={0}
                        placeholder="£0"
                        value={settings.costPerWeek?.[h.id] ?? ''}
                        onChange={(v) => updateSettings({ costPerWeek: { ...settings.costPerWeek, [h.id]: Number(v) || 0 } })}
                      />
                      <NumberInput
                        size="xs"
                        label="Allowed / week"
                        min={0}
                        max={7}
                        value={settings.weeklyLimits?.[h.id] ?? h.weeklyLimit ?? 0}
                        onChange={(v) => updateSettings({ weeklyLimits: { ...settings.weeklyLimits, [h.id]: Math.max(0, Number(v) || 0) } })}
                      />
                    </Group>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <AddHabitModal opened={adding} onClose={() => setAdding(false)} />
    </Card>
  );
}
