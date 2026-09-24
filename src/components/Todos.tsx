import { ActionIcon, Badge, Button, Card, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconPencil, IconPlus } from '@tabler/icons-react';
import { useState, type MouseEvent } from 'react';
import { burst, pop } from '../lib/celebrate';
import { fmt, type DateKey } from '../lib/dates';
import { floatXp, notifyUndo } from '../lib/feedback';
import { newId, removeItem, upsert, useApp } from '../lib/store';
import { carriedDays, openTodos, todosOn } from '../lib/todos';
import type { Todo } from '../lib/types';
import { CheckCircle, Tap } from './ui';

function toggleTodo(todo: Todo, today: DateKey, e: MouseEvent) {
  if (todo.doneOn) return upsert('todos', { ...todo, doneOn: null });
  upsert('todos', { ...todo, doneOn: today });
  pop(e);
  floatXp(e, 'Done ✓');
  if (!openTodos(useApp.getState().todos, today).length) burst();
}

/** One to-do: tap anywhere on it to tick it off, pencil to change it. */
export function TodoRow({ todo, today, onEdit }: { todo: Todo; today: DateKey; onEdit: (t: Todo) => void }) {
  const done = !!todo.doneOn;
  const late = carriedDays(todo, today);
  return (
    <div className="hrow" data-state={done ? 'done' : undefined}>
      <Group gap={4} wrap="nowrap">
        <Tap onClick={(e) => toggleTodo(todo, today, e)} style={{ flex: 1, minWidth: 0 }} aria-label={todo.title}>
          <div className="hrow-main">
            <CheckCircle checked={done} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hrow-label" style={done ? { textDecoration: 'line-through' } : undefined}>
                {todo.title}
              </div>
              {late > 0 && (
                <Text size="xs" c="orange.4" fw={600}>
                  ↪ Carried over from {fmt(todo.date, 'ddd D MMM')} · {late} day{late === 1 ? '' : 's'}
                </Text>
              )}
              {todo.notes && (
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {todo.notes}
                </Text>
              )}
            </div>
          </div>
        </Tap>
        <ActionIcon variant="subtle" color="gray" onClick={() => onEdit(todo)} aria-label={`Edit ${todo.title}`}>
          <IconPencil size={16} />
        </ActionIcon>
      </Group>
    </div>
  );
}

/** Add or change a to-do. */
export function TodoModal({ opened, onClose, initial }: { opened: boolean; onClose: () => void; initial: Partial<Todo> }) {
  const [draft, setDraft] = useState<Partial<Todo>>(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setDraft(initial);
  }
  const valid = !!draft.title?.trim() && !!draft.date;

  const remove = () => {
    const old = initial as Todo;
    removeItem('todos', old.id);
    onClose();
    notifyUndo('To-do deleted', () => upsert('todos', old));
  };

  return (
    <Modal opened={opened} onClose={onClose} title={draft.id ? 'Edit to-do' : 'New to-do'}>
      <Stack>
        <TextInput
          label="What needs doing"
          placeholder="Book the dentist, send the form…"
          data-autofocus
          value={draft.title ?? ''}
          onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })}
        />
        <DatePickerInput
          label="Day"
          valueFormat="dddd D MMMM YYYY"
          description="If it's not done by then, it carries over to today until it is."
          value={draft.date ?? null}
          onChange={(d) => setDraft({ ...draft, date: d ?? undefined })}
        />
        <Textarea label="Notes" autosize minRows={2} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.currentTarget.value })} />
        <Group grow>
          {draft.id && (
            <Button variant="light" color="red" onClick={remove}>
              Delete
            </Button>
          )}
          <Button
            disabled={!valid}
            onClick={() => {
              upsert('todos', {
                id: draft.id ?? newId(),
                title: draft.title!.trim(),
                date: draft.date!,
                doneOn: draft.doneOn ?? null,
                notes: draft.notes?.trim() || undefined,
                createdAt: draft.createdAt ?? Date.now(),
              });
              onClose();
            }}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Today's to-dos (including any carried over), with a quick-add box. */
export default function TodoCard({ today }: { today: DateKey }) {
  const todos = useApp((s) => s.todos);
  const [text, setText] = useState('');
  const [opened, modal] = useDisclosure(false);
  const [draft, setDraft] = useState<Partial<Todo>>({});
  const list = todosOn(todos, today, today);
  const left = list.filter((t) => !t.doneOn).length;

  const add = () => {
    const title = text.trim();
    if (!title) return;
    upsert('todos', { id: newId(), title, date: today, doneOn: null, createdAt: Date.now() });
    setText('');
  };
  const edit = (t: Partial<Todo>) => {
    setDraft(t);
    modal.open();
  };

  return (
    <Card p="sm">
      {list.length > 0 && (
        <Group justify="space-between" px={4} mb={4}>
          <Text fw={800} fz={17}>
            📝 To-dos
          </Text>
          <Badge color={left ? 'orange' : 'teal'} variant="light">
            {left ? `${left} left` : 'All done'}
          </Badge>
        </Group>
      )}
      {list.map((t) => (
        <TodoRow key={t.id} todo={t} today={today} onEdit={edit} />
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Group gap="xs" wrap="nowrap" mt={list.length ? 'xs' : 0}>
          <TextInput
            style={{ flex: 1 }}
            placeholder={list.length ? 'Add another…' : '📝 Add a to-do for today…'}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            enterKeyHint="done"
            aria-label="New to-do"
          />
          <ActionIcon type="submit" size="lg" variant="light" disabled={!text.trim()} aria-label="Add to-do">
            <IconPlus size={18} />
          </ActionIcon>
        </Group>
      </form>
      <TodoModal opened={opened} onClose={modal.close} initial={draft} />
    </Card>
  );
}
