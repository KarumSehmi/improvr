import { ActionIcon, Button, Card, Group, NumberInput, Select, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconAdjustmentsHorizontal, IconArrowUp, IconChevronRight, IconX } from '@tabler/icons-react';
import { useMemo, useState, type MouseEvent } from 'react';
import { addTodo, deleteTodo, toggleTodo as toggle } from '../lib/actions';
import { burst, pop } from '../lib/celebrate';
import type { DateKey } from '../lib/dates';
import { floatXp } from '../lib/feedback';
import { editTodo as openTodo, goTo, useToday, useUi } from '../lib/hooks';
import { dayLabel, parseTodo, repeatLabel, timeLabel, type ChipKind } from '../lib/quickadd';
import { newId, updateSettings, upsert, useApp } from '../lib/store';
import { carriedDays, openTodos, snoozeOptions, todoListsFor, todosOn } from '../lib/todos';
import type { Todo } from '../lib/types';
import { CheckCircle, M, Meta, PanelHead, Sheet, Tap, accent } from './ui';

function tick(todo: Todo, today: DateKey, e: MouseEvent) {
  if (!toggle(todo, today)) return;
  pop(e);
  floatXp(e, 'Done ✓');
  if (!openTodos(useApp.getState().todos, today).length) burst();
}

/** One to-do: tap to tick it off, hold (or the arrow) to change it. */
export function TodoRow({ todo, today, showDate }: { todo: Todo; today: DateKey; showDate?: boolean }) {
  const lists = useApp((s) => todoListsFor(s.settings));
  const done = !!todo.doneOn;
  const late = carriedDays(todo, today);
  const list = todo.list ? lists.find((l) => l.id === todo.list) : null;
  return (
    <div className="hrow" data-state={done ? 'done' : undefined} style={accent('blue')}>
      <Group gap={4} wrap="nowrap">
        <Tap onClick={(e) => tick(todo, today, e)} onLongPress={() => openTodo(todo.id)} style={{ flex: 1, minWidth: 0 }} aria-label={todo.title} aria-pressed={done}>
          <div className="hrow-main">
            <CheckCircle checked={done} color="blue" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hrow-label" style={done ? { textDecoration: 'line-through' } : undefined}>
                {todo.important && !done ? <span style={{ color: 'var(--mantine-color-yellow-5)' }}>★ </span> : null}
                {todo.title}
              </div>
              <Meta>
                {late > 0 && !done && <M tone="warn">↪ {late} day{late === 1 ? '' : 's'} late</M>}
                {showDate && todo.date && todo.date !== today && !done && <M>{dayLabel(todo.date, today)}</M>}
                {todo.time && !done && <M tone="accent">{timeLabel(todo.time)}</M>}
                {!!todo.repeat && !done && <M>↻ {repeatLabel(todo.repeat)}</M>}
                {list && (
                  <M>
                    {list.emoji} {list.name}
                  </M>
                )}
                {todo.notes && <M>{todo.notes.split('\n')[0].slice(0, 60)}</M>}
              </Meta>
            </div>
          </div>
        </Tap>
        <ActionIcon variant="subtle" color="gray" onClick={() => openTodo(todo.id)} aria-label={`Edit ${todo.title}`}>
          <IconChevronRight size={17} />
        </ActionIcon>
      </Group>
    </div>
  );
}

/**
 * Type it how you'd say it: "Dentist fri 3pm", "Essay due 12 oct !", "Haircut every 2 weeks #home".
 * Shows what it understood; tap ✕ on a chip if it got the wrong idea.
 */
export function QuickAdd({ today, placeholder = 'Add a to-do…', date, list, autoFocus }: { today: DateKey; placeholder?: string; date?: DateKey | null; list?: string | null; autoFocus?: boolean }) {
  const lists = useApp((s) => todoListsFor(s.settings));
  const [text, setText] = useState('');
  const [ignore, setIgnore] = useState<ChipKind[]>([]);
  const parsed = useMemo(() => parseTodo(text, today, lists, ignore), [text, today, lists, ignore]);

  const add = () => {
    if (!parsed.title) return;
    const when = parsed.date !== undefined ? parsed.date : date;
    const t = addTodo({ title: parsed.title, date: when, time: parsed.time ?? null, repeat: parsed.repeat ?? null, important: parsed.important, list: parsed.list ?? list ?? null }, today);
    setText('');
    setIgnore([]);
    pop();
    if (t.date !== today) notifications.show({ color: 'blue', title: 'Added', message: `${t.title} — ${t.date ? dayLabel(t.date, today) : 'someday'}` });
  };
  const more = () => {
    useUi.setState({ todoEdit: { title: parsed.title || text, date: parsed.date !== undefined ? parsed.date : (date ?? today) } });
    setText('');
    setIgnore([]);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <TextInput
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.currentTarget.value);
          if (!e.currentTarget.value) setIgnore([]);
        }}
        enterKeyHint="done"
        aria-label="New to-do"
        autoFocus={autoFocus}
        radius="xl"
        size="md"
        rightSectionWidth={text ? 76 : 44}
        rightSection={
          <Group gap={2} wrap="nowrap" pr={4}>
            {text && (
              <ActionIcon variant="subtle" color="gray" onClick={more} aria-label="More options">
                <IconAdjustmentsHorizontal size={17} />
              </ActionIcon>
            )}
            <ActionIcon type="submit" variant={parsed.title ? 'gradient' : 'subtle'} color="gray" disabled={!parsed.title} aria-label="Add to-do">
              <IconArrowUp size={17} stroke={2.6} />
            </ActionIcon>
          </Group>
        }
      />
      {parsed.chips.length > 0 && (
        <div className="chip-row" style={{ marginTop: 8 }}>
          {parsed.chips.map((c) => (
            <span key={c.kind} className="chip" data-small data-active style={accent(c.kind === 'important' ? 'yellow' : 'blue')}>
              {c.kind === 'date' ? '📅' : c.kind === 'time' ? '🕒' : c.kind === 'repeat' ? '↻' : c.kind === 'important' ? '★' : ''} {c.label}
              <IconX size={12} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setIgnore([...ignore, c.kind])} aria-label={`Not ${c.label}`} />
            </span>
          ))}
        </div>
      )}
    </form>
  );
}

/** Today's to-dos (including any carried over), with a quick-add box. */
export default function TodoCard({ today }: { today: DateKey }) {
  const todos = useApp((s) => s.todos);
  const list = todosOn(todos, today, today);
  const left = list.filter((t) => !t.doneOn);
  const late = left.filter((t) => carriedDays(t, today) > 0).length;
  const hideDone = useUi((s) => s.hideDone);
  const shown = hideDone ? left : list;

  return (
    <Card id="todos" p="sm" px="md" style={{ scrollMarginTop: 90 }}>
      <PanelHead
        emoji="📝"
        color="blue"
        title="To-dos"
        sub={list.length ? (left.length ? `${left.length} left${late ? ` · ${late} carried over` : ''}` : 'All done today 🙌') : 'Nothing for today yet'}
        right={
          <Button size="compact-sm" variant="subtle" color="gray" rightSection={<IconChevronRight size={14} />} onClick={() => goTo('plan', { planTab: 'tasks' })}>
            All
          </Button>
        }
      />
      {shown.length > 0 && <div style={{ marginTop: 4 }}>{shown.map((t) => <TodoRow key={t.id} todo={t} today={today} />)}</div>}
      <div style={{ marginTop: 10 }}>
        <QuickAdd today={today} placeholder={list.length ? 'Add another… try "call bank fri 3pm"' : 'Add a to-do… try "dentist tomorrow 3pm"'} />
      </div>
    </Card>
  );
}

const REPEATS = [
  { value: '0', label: "Doesn't repeat" },
  { value: '1', label: 'Every day' },
  { value: '3', label: 'Every 3 days' },
  { value: '7', label: 'Every week' },
  { value: '14', label: 'Every 2 weeks' },
  { value: '28', label: 'Every 4 weeks' },
  { value: '30', label: 'Every month' },
  { value: 'custom', label: 'Every … days' },
];

/** Add or change a to-do: when, what time, repeats, list, star and notes. Opened from anywhere. */
export function TodoEditor() {
  const edit = useUi((s) => s.todoEdit);
  const todos = useApp((s) => s.todos);
  const settings = useApp((s) => s.settings);
  const lists = todoListsFor(settings);
  const today = useToday();
  const existing = edit?.id ? todos[edit.id] : undefined;
  const [draft, setDraft] = useState<Partial<Todo>>({});
  const [key, setKey] = useState<unknown>(null);
  const [newList, setNewList] = useState<{ emoji: string; name: string } | null>(null);
  // Fresh draft each time it opens
  if (key !== edit) {
    setKey(edit);
    setNewList(null);
    setDraft(existing ? { ...existing } : edit ? { title: edit.title ?? '', date: edit.date === undefined ? today : edit.date } : {});
  }
  const close = () => useUi.setState({ todoEdit: null });
  const valid = !!draft.title?.trim();
  const repeat = draft.repeat ?? 0;
  const preset = REPEATS.some((r) => r.value === String(repeat)) ? String(repeat) : 'custom';
  const set = (patch: Partial<Todo>) => setDraft({ ...draft, ...patch });

  const save = () => {
    const base: Todo = {
      id: draft.id ?? newId(),
      title: draft.title!.trim(),
      date: draft.date ?? null,
      time: draft.time || null,
      list: draft.list ?? null,
      important: draft.important || undefined,
      doneOn: draft.doneOn ?? null,
      notes: draft.notes?.trim() || undefined,
      repeat: draft.date ? draft.repeat || null : null,
      next: draft.next ?? null,
      createdAt: draft.createdAt ?? Date.now(),
    };
    upsert('todos', base);
    close();
  };

  const addList = () => {
    if (!newList?.name.trim()) return;
    const l = { id: newId(), name: newList.name.trim(), emoji: newList.emoji.trim() || '📌' };
    updateSettings({ todoLists: [...lists, l] });
    set({ list: l.id });
    setNewList(null);
  };

  const quick = [{ label: 'Today', date: today as DateKey | null }, ...snoozeOptions(today)];

  return (
    <Sheet opened={!!edit} onClose={close} title={existing ? 'Edit to-do' : 'New to-do'}>
      <Stack gap="md">
        <TextInput
          label="What needs doing"
          placeholder="Book the dentist, send the form…"
          data-autofocus
          size="md"
          value={draft.title ?? ''}
          onChange={(e) => set({ title: e.currentTarget.value })}
          onKeyDown={(e) => e.key === 'Enter' && valid && save()}
        />

        <div>
          <Text size="sm" fw={600} mb={6}>
            When
          </Text>
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
            {quick.map((q) => (
              <Tap key={q.label} className="chip" data-active={draft.date === q.date || undefined} onClick={() => set({ date: q.date, repeat: q.date ? draft.repeat : null })} style={accent('blue')}>
                {q.label}
              </Tap>
            ))}
          </div>
          {draft.date !== null && (
            <Group grow mt="sm" align="flex-start">
              <DatePickerInput
                valueFormat="ddd D MMM YYYY"
                value={draft.date ?? null}
                onChange={(d) => set({ date: d ?? null })}
                aria-label="Day"
                description={draft.date && draft.date < today ? 'Carries over to today until done' : 'Not done by then? It carries over.'}
              />
              <TimeInput value={draft.time ?? ''} onChange={(e) => set({ time: e.currentTarget.value || null })} aria-label="Time" description="Time (optional)" />
            </Group>
          )}
          {draft.date === null && (
            <Text size="xs" c="dimmed" mt={6}>
              Someday: no date, so it never nags. It waits in Plan → Someday.
            </Text>
          )}
        </div>

        {draft.date !== null && (
          <Group grow align="flex-end">
            <Select label="Repeat" data={REPEATS} value={preset} onChange={(v) => set({ repeat: v === 'custom' ? 10 : Number(v) || null })} allowDeselect={false} />
            {preset === 'custom' && <NumberInput min={1} max={365} suffix=" days" value={repeat} onChange={(v) => set({ repeat: Math.max(1, Number(v) || 1) })} aria-label="Every how many days" />}
          </Group>
        )}
        {repeat > 0 && draft.date !== null && (
          <Text size="xs" c="dimmed" mt={-8}>
            When you tick it off, the next one comes up {repeat === 1 ? 'tomorrow' : `${repeat} days later`}.
          </Text>
        )}

        <div>
          <Text size="sm" fw={600} mb={6}>
            List
          </Text>
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
            <Tap className="chip" data-active={!draft.list || undefined} onClick={() => set({ list: null })}>
              None
            </Tap>
            {lists.map((l) => (
              <Tap key={l.id} className="chip" data-active={draft.list === l.id || undefined} onClick={() => set({ list: l.id })}>
                {l.emoji} {l.name}
              </Tap>
            ))}
            {!newList && (
              <Tap className="chip" onClick={() => setNewList({ emoji: '📌', name: '' })} style={{ borderStyle: 'dashed', borderColor: 'var(--line-strong)' }}>
                + New list
              </Tap>
            )}
          </div>
          {newList && (
            <Group gap="xs" mt="sm" wrap="nowrap">
              <TextInput w={64} value={newList.emoji} onChange={(e) => setNewList({ ...newList, emoji: e.currentTarget.value })} aria-label="Emoji" maxLength={4} />
              <TextInput style={{ flex: 1 }} placeholder="List name" value={newList.name} onChange={(e) => setNewList({ ...newList, name: e.currentTarget.value })} data-autofocus />
              <Button onClick={addList} disabled={!newList.name.trim()}>
                Add
              </Button>
            </Group>
          )}
        </div>

        <Switch
          color="yellow"
          checked={!!draft.important}
          onChange={(e) => set({ important: e.currentTarget.checked })}
          label="★ Star it"
          description="Starred to-dos go to the top and get louder in Up next"
        />

        <Textarea label="Notes" autosize minRows={2} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.currentTarget.value })} />

        <Group grow mt="xs">
          {existing && (
            <Button
              variant="light"
              color="red"
              onClick={() => {
                deleteTodo(existing);
                close();
              }}
            >
              Delete
            </Button>
          )}
          <Button disabled={!valid} onClick={save} variant="gradient">
            {existing ? 'Save' : 'Add to-do'}
          </Button>
        </Group>
      </Stack>
    </Sheet>
  );
}
