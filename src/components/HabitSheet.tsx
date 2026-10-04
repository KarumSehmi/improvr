/**
 * Everything about one habit, opened by pressing and holding it (or from Settings → Habits):
 * what to do with it today, how it's going, and every setting it has.
 */
import { Button, Divider, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { useState, type ReactNode } from 'react';
import { answerClean, answerTime, beatUrge, deleteHabit, editHabit, resetHabit, setDone, setFrequency, setHabitOn, setMissed, setSchedule, setSkipped } from '../lib/actions';
import { FLEXIBLE_KINDS, completionRate, everyOn } from '../lib/engine';
import { FREQUENCY_OPTIONS, KIND_LABEL, SECTIONS, WEEKDAYS, allHabits, habitLabel, scheduleLabel, type ChoreSchedule, type Habit, type SectionId } from '../lib/config';
import { dateKey, relativeDay, weekday } from '../lib/dates';
import { useSummary, useToday, useUi } from '../lib/hooks';
import { habitHistory } from '../lib/trend';
import { updateSettings, useApp } from '../lib/store';
import { Sheet, Tap, Tile, WeekDots } from './ui';
import { accent } from '../lib/style';

const POINTS = [5, 10, 15, 20, 25, 30, 40];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const EVERY_OPTIONS = [1, 2, 3, 4, 5, 7, 10, 14, 21, 28];

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Text size="sm" fw={650} mb={6}>
        {label}
      </Text>
      {children}
      {hint && (
        <Text size="xs" c="dimmed" mt={6}>
          {hint}
        </Text>
      )}
    </div>
  );
}

/** Repeating jobs: every N days after you last did it, or on a day of the week (every week or every few weeks). */
function ScheduleEditor({ habit }: { habit: Habit }) {
  const anchors = useApp((s) => s.settings.anchors);
  const s = habit.schedule!;
  const rolling = 'every' in s;
  const set = (next: ChoreSchedule) => setSchedule(habit.id, next);
  return (
    <Stack gap="sm">
      <SegmentedControl
        fullWidth
        value={rolling ? 'every' : 'weekday'}
        onChange={(v) => set(v === 'every' ? { every: 'every' in s ? s.every : 7 } : { weekday: 'weekday' in s ? s.weekday : 6 })}
        data={[
          { value: 'every', label: 'Every few days' },
          { value: 'weekday', label: 'On a weekday' },
        ]}
      />
      {rolling ? (
        <Select
          data={[...new Set([...EVERY_OPTIONS, s.every])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: n === 1 ? 'Every day' : scheduleLabel({ every: n }).replace(/^every/, 'Every') }))}
          value={String(s.every)}
          onChange={(v) => v && set({ ...s, every: Number(v) })}
          allowDeselect={false}
          aria-label="How often"
        />
      ) : (
        <>
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
            {WEEKDAYS.map((d, i) => (
              <Tap key={d} className="chip" data-active={s.weekday === i || undefined} onClick={() => set({ ...s, weekday: i })}>
                {d.slice(0, 3)}
              </Tap>
            ))}
          </div>
          <Select
            data={[
              { value: '1', label: 'Every week' },
              { value: '2', label: 'Every other week' },
              { value: '3', label: 'Every 3 weeks' },
              { value: '4', label: 'Every 4 weeks' },
            ]}
            value={String(s.everyWeeks ?? 1)}
            onChange={(v) => v && set({ ...s, everyWeeks: Number(v) > 1 ? Number(v) : undefined })}
            allowDeselect={false}
            aria-label="How many weeks"
          />
          {(s.everyWeeks ?? 1) > 1 && (
            <DatePickerInput
              label="Next one on"
              description={`Pick the ${WEEKDAYS[s.weekday]} it's next due — it repeats from there`}
              value={anchors?.[habit.id] ?? null}
              excludeDate={(d) => weekday(d) !== s.weekday}
              onChange={(d) => updateSettings({ anchors: { ...anchors, [habit.id]: d ?? '' } })}
              clearable
            />
          )}
        </>
      )}
      <Text size="xs" c="dimmed">
        Changing this re-plans when it's due, including any it's carrying over.
      </Text>
    </Stack>
  );
}

/** What you can do with the habit on the day you opened it from. */
function DayActions({ habit, date }: { habit: Habit; date: string }) {
  const summary = useSummary();
  const log = useApp((s) => s.days[date]);
  const item = summary.evalByDate[date]?.items.find((i) => i.habit.id === habit.id);
  const today = useToday();
  if (!item?.visible) return null;
  const close = () => useUi.setState({ habitSheet: null });
  const when = relativeDay(date, today);
  const btn = (label: string, onClick: () => void, color = 'gray', variant: 'light' | 'filled' | 'default' = 'light') => (
    <Button
      key={label}
      variant={variant}
      color={color}
      onClick={() => {
        onClick();
        close();
      }}
    >
      {label}
    </Button>
  );

  let buttons: ReactNode[] = [];
  if (habit.kind === 'avoid') {
    const a = log?.avoid?.[habit.id];
    buttons = [btn('Clean', () => answerClean(date, habit, 'clean'), 'teal', a === 'clean' ? 'filled' : 'light'), btn('Slipped', () => answerClean(date, habit, 'slip'), 'red', a === 'slip' ? 'filled' : 'light'), a ? btn('Clear', () => answerClean(date, habit, null)) : null].filter(Boolean);
  } else if (habit.kind === 'time') {
    const a = log?.done?.[habit.id];
    buttons = [btn('Yes', () => answerTime(date, habit, true), 'teal', a === true ? 'filled' : 'light'), btn('No', () => answerTime(date, habit, false), 'red', a === false ? 'filled' : 'light'), a != null ? btn('Clear', () => answerTime(date, habit, null)) : null].filter(Boolean);
  } else {
    buttons = [
      item.done ? btn('Undo', () => setDone(date, habit, false)) : btn('Done ✓', () => setDone(date, habit, true), 'teal', 'filled'),
      item.missed ? btn('Undo "not done"', () => setMissed(date, habit, false)) : !item.done ? btn(habit.kind === 'chore' ? 'Not today' : 'Not done', () => setMissed(date, habit, true), 'red') : null,
      habit.kind === 'chore' && !item.done ? btn(item.skipped ? 'Undo skip' : 'Skip this one', () => setSkipped(date, habit, !item.skipped)) : null,
    ].filter(Boolean);
  }
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {when}
      </div>
      <SimpleGrid cols={buttons.length} spacing="xs">
        {buttons}
      </SimpleGrid>
      {habit.kind === 'avoid' && (
        <Button
          mt="xs"
          fullWidth
          variant="light"
          color="grape"
          onClick={() => {
            beatUrge(date, habit);
            close();
          }}
        >
          💪 I beat an urge{log?.urges?.[habit.id] ? ` (${log.urges[habit.id]} today)` : ''} · +5 XP
        </Button>
      )}
      {habit.kind === 'chore' && !item.done && (
        <Text size="xs" c="dimmed" mt={6}>
          {item.skipped ? 'Skipped — it comes round again on its schedule.' : '"Skip this one" moves it on to its next time without counting against you.'}
        </Text>
      )}
    </div>
  );
}

export default function HabitSheet() {
  const sheet = useUi((s) => s.habitSheet);
  const settings = useApp((s) => s.settings);
  const summary = useSummary();
  const habit = sheet ? allHabits(settings).find((h) => h.id === sheet.id) : undefined;
  const close = () => useUi.setState({ habitSheet: null });
  return (
    <Sheet opened={!!sheet && !!habit} onClose={close} size="md" zIndex={310}>
      {habit && sheet && <Body key={habit.id} habit={habit} date={sheet.date} summaryHabits={summary.habits} />}
    </Sheet>
  );
}

function Body({ habit, date, summaryHabits }: { habit: Habit; date: string | null; summaryHabits: Habit[] }) {
  const settings = useApp((s) => s.settings);
  const summary = useSummary();
  const today = dateKey();
  const on = !(settings.hiddenHabits ?? []).includes(habit.id);
  const section = SECTIONS.find((s) => s.id === habit.section)!;
  const streak = summary.habitStreaks[habit.id];
  const rate = on ? completionRate(summary, habit.id, 30) : null;
  const history = on ? habitHistory(summary, habit.id, 14) : [];
  const [label, setLabel] = useState(habit.label);
  const [emoji, setEmoji] = useState(habit.emoji);
  const [hint, setHint] = useState(habit.hint ?? '');
  // Follow changes made elsewhere (e.g. "Reset to how it came"); typing only saves when you leave the box.
  const [saved, setSaved] = useState({ label: habit.label, emoji: habit.emoji, hint: habit.hint ?? '' });
  if (saved.label !== habit.label || saved.emoji !== habit.emoji || saved.hint !== (habit.hint ?? '')) {
    if (saved.label !== habit.label) setLabel(habit.label);
    if (saved.emoji !== habit.emoji) setEmoji(habit.emoji);
    if (saved.hint !== (habit.hint ?? '')) setHint(habit.hint ?? '');
    setSaved({ label: habit.label, emoji: habit.emoji, hint: habit.hint ?? '' });
  }
  const edited = !habit.custom && (settings.habitEdits?.[habit.id] || settings.scheduleOverrides?.[habit.id] || settings.weeklyLimits?.[habit.id] != null);
  const flexible = (FLEXIBLE_KINDS as readonly string[]).includes(habit.kind) && !habit.optional;
  const restable = ['check', 'water', 'count', 'dose'].includes(habit.kind);
  const rest = new Set(habit.restDays ?? []);
  const close = () => useUi.setState({ habitSheet: null });
  const name = date ? habitLabel(habit, settings, date) : habit.label;

  return (
    <Stack gap="lg" style={accent(section.color)}>
      <Group gap="md" wrap="nowrap" mt={4}>
        <Tile emoji={habit.emoji} color={section.color} size={56} dim={!on} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text fw={850} fz={20} lh={1.2} lts={-0.3}>
            {name}
          </Text>
          <Text size="xs" c="dimmed" fw={600} mt={2}>
            {section.emoji} {section.title} · {KIND_LABEL[habit.kind]}
          </Text>
        </div>
      </Group>

      {on && date && <DayActions habit={habit} date={date} />}

      {on && summaryHabits.some((h) => h.id === habit.id) && (
        <div>
          <SimpleGrid cols={3} spacing="xs">
            {[
              [`🔥 ${streak?.current ?? 0}`, 'current run'],
              [`🏁 ${streak?.best ?? 0}`, 'best run'],
              [rate == null ? '—' : `${rate}%`, 'last 30 days'],
            ].map(([v, l]) => (
              <div key={l} style={{ background: 'var(--raised)', borderRadius: 14, padding: '10px 12px' }}>
                <Text fw={900} fz={18} className="num">
                  {v}
                </Text>
                <Text size="xs" c="dimmed" fw={600}>
                  {l}
                </Text>
              </div>
            ))}
          </SimpleGrid>
          <Group justify="space-between" mt={10}>
            <Text size="xs" c="dimmed" fw={600}>
              Last 2 weeks
            </Text>
            <WeekDots days={history} color={section.color} />
          </Group>
        </div>
      )}

      <Divider label="Edit" labelPosition="left" />

      <Group gap="xs" wrap="nowrap" align="flex-end">
        <TextInput
          label="Emoji"
          w={72}
          value={emoji}
          onChange={(e) => setEmoji(e.currentTarget.value)}
          onBlur={() => (!emoji.trim() ? setEmoji(habit.emoji) : emoji !== habit.emoji && editHabit(habit.id, { emoji: emoji.trim() }))}
          maxLength={4}
        />
        <TextInput
          label="Name"
          style={{ flex: 1 }}
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          onBlur={() => (!label.trim() ? setLabel(habit.label) : label !== habit.label && editHabit(habit.id, { label: label.trim() }))}
        />
      </Group>

      {habit.kind !== 'avoid' && (
        <Field label="Part of the day">
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
            {SECTIONS.filter((s) => s.id !== 'clean').map((s) => (
              <Tap key={s.id} className="chip" data-active={habit.section === s.id || undefined} style={accent(s.color)} onClick={() => editHabit(habit.id, { section: s.id as SectionId })}>
                {s.emoji} {s.short}
              </Tap>
            ))}
          </div>
        </Field>
      )}

      <Field label="XP" hint="What it's worth when you do it. Changes apply to past days too.">
        <div className="chip-row" style={{ flexWrap: 'wrap' }}>
          {[...new Set([...POINTS, habit.points])]
            .sort((a, b) => a - b)
            .map((p) => (
              <Tap key={p} className="chip" data-active={habit.points === p || undefined} onClick={() => editHabit(habit.id, { points: p })}>
                {p}
              </Tap>
            ))}
        </div>
      </Field>

      {habit.kind === 'chore' && habit.schedule && (
        <Field label="When it's due">
          <ScheduleEditor habit={habit} />
        </Field>
      )}

      {flexible && (
        <Field label="How often" hint="It only shows up when it's due, and carries over if you miss it. Changes apply from today — past days keep the old rule.">
          <Select data={FREQUENCY_OPTIONS} value={String(everyOn(settings, habit.id, today))} onChange={(v) => v && setFrequency(habit.id, Number(v))} allowDeselect={false} />
        </Field>
      )}

      {restable && (
        <Field label="Days off from it" hint={`${rest.size ? `Not shown (or counted) on ${[...rest].sort().map((d) => WEEKDAYS[d]).join(', ')}.` : 'Tap a day to skip it every week (e.g. nothing on football Mondays).'} Applies to past days too.`}>
          <Group gap={6} wrap="nowrap">
            {DAY_LETTERS.map((l, i) => {
              const off = rest.has(i);
              return (
                <Tap
                  key={i}
                  className="chip"
                  data-active={!off || undefined}
                  aria-label={`${WEEKDAYS[i]}: ${off ? 'off' : 'on'}`}
                  aria-pressed={!off}
                  onClick={() => {
                    const next = new Set(rest);
                    if (off) next.delete(i);
                    else next.add(i);
                    editHabit(habit.id, { restDays: [...next].sort() });
                  }}
                  style={{ width: 38, padding: 0, justifyContent: 'center', textDecoration: off ? 'line-through' : undefined }}
                >
                  {l}
                </Tap>
              );
            })}
          </Group>
        </Field>
      )}

      {(habit.kind === 'water' || habit.kind === 'count') && (
        <Group grow align="flex-start">
          <NumberInput
            label={habit.kind === 'water' ? 'Bottles a day' : 'Target'}
            description="Past days too"
            min={1}
            max={500}
            value={habit.target ?? (habit.kind === 'water' ? 2 : 1)}
            onChange={(v) => Number(v) >= 1 && editHabit(habit.id, { target: Number(v) })}
          />
          {habit.kind === 'count' && (
            <TextInput key={habit.unit ?? ''} label="Unit" description="What you're counting" placeholder="pages, mins…" defaultValue={habit.unit ?? ''} onBlur={(e) => editHabit(habit.id, { unit: e.currentTarget.value.trim() || undefined })} />
          )}
        </Group>
      )}

      {habit.kind === 'dose' && (
        <Group grow align="flex-start">
          <NumberInput
            label="Amount per dose"
            description="What a tick logs"
            suffix=" ml"
            min={0.1}
            step={0.25}
            decimalScale={2}
            value={settings.finTargetMl}
            onChange={(v) => Number(v) > 0 && updateSettings({ finTargetMl: Number(v) })}
          />
          <NumberInput
            label="Strength"
            description={`${+(settings.finTargetMl * settings.finConcentration * 10).toFixed(3)} mg a dose`}
            suffix="%"
            min={0.001}
            step={0.005}
            decimalScale={3}
            value={settings.finConcentration}
            onChange={(v) => Number(v) > 0 && updateSettings({ finConcentration: Number(v) })}
          />
        </Group>
      )}

      {habit.kind === 'avoid' && (
        <>
          <Group grow align="flex-start">
            <NumberInput
              label="Allowed a week"
              description="Slips inside this keep the streak"
              min={0}
              max={7}
              value={settings.weeklyLimits?.[habit.id] ?? habit.weeklyLimit ?? 0}
              onChange={(v) => updateSettings({ weeklyLimits: { ...settings.weeklyLimits, [habit.id]: Math.max(0, Number(v) || 0) } })}
            />
            <NumberInput
              label="It cost me / week"
              description="To show what you've saved"
              prefix="£"
              min={0}
              placeholder="£0"
              value={settings.costPerWeek?.[habit.id] ?? ''}
              onChange={(v) => updateSettings({ costPerWeek: { ...settings.costPerWeek, [habit.id]: Number(v) || 0 } })}
            />
          </Group>
          <Textarea
            label="Why you're doing this"
            description="Shows when a craving hits"
            autosize
            minRows={1}
            key={settings.reasons?.[habit.id] ?? ''}
            defaultValue={settings.reasons?.[habit.id] ?? ''}
            onBlur={(e) => updateSettings({ reasons: { ...settings.reasons, [habit.id]: e.currentTarget.value.trim() } })}
          />
        </>
      )}

      <TextInput label="Little note under the name" placeholder="e.g. AM, Peloton, last night" value={hint} onChange={(e) => setHint(e.currentTarget.value)} onBlur={() => hint !== (habit.hint ?? '') && editHabit(habit.id, { hint: hint.trim() })} />

      <Stack gap="sm">
        {!['avoid', 'time', 'chore'].includes(habit.kind) && (
          <Switch
            color="teal"
            checked={!!habit.optional}
            onChange={(e) => editHabit(habit.id, { optional: e.currentTarget.checked })}
            label="Bonus"
            description="Earns XP when you do it; skipping it never hurts your score (past days included)"
          />
        )}
        <Switch color="pink" checked={!!habit.important} onChange={(e) => editHabit(habit.id, { important: e.currentTarget.checked })} label="Key habit" description="Marked with a ★ on your list" />
        <Switch
          color="teal"
          checked={on}
          onChange={(e) => setHabitOn(habit.id, e.currentTarget.checked)}
          label="Track it"
          description={on ? 'Switch off to hide it. Its history stays.' : "Switched off — it's hidden and doesn't count"}
        />
      </Stack>

      <Group grow>
        {edited && (
          <Button variant="default" onClick={() => resetHabit(habit.id)}>
            Reset to how it came
          </Button>
        )}
        {habit.custom && (
          <Button
            variant="light"
            color="red"
            onClick={() =>
              modals.openConfirmModal({
                title: `Delete "${habit.label}"?`,
                children: <Text size="sm">Its history stays in your old days but it won't show up any more. (Switching it off instead keeps it restorable.)</Text>,
                labels: { confirm: 'Delete', cancel: 'Cancel' },
                confirmProps: { color: 'red' },
                onConfirm: () => {
                  deleteHabit(habit.id);
                  close();
                },
              })
            }
          >
            Delete habit
          </Button>
        )}
      </Group>
    </Stack>
  );
}
