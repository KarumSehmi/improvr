import { Badge, Card, Collapse, Group, Text, Textarea, UnstyledButton } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { motion } from 'motion/react';
import { useState } from 'react';
import { MOODS } from '../lib/config';
import type { DateKey } from '../lib/dates';
import { updateDay } from '../lib/store';
import { Tap } from './ui';

/** `later`: before the evening it stays folded away (unless you've already written something). */
export default function ReflectionCard({ date, note, mood, later }: { date: DateKey; note: string; mood: number | undefined; later?: boolean }) {
  const [unfolded, setUnfolded] = useState(false);
  const open = !later || unfolded || !!note || !!mood;
  const [value, setValue] = useState(note);
  const [editingDate, setEditingDate] = useState(date);
  if (editingDate !== date) {
    setEditingDate(date);
    setValue(note);
  }
  const save = useDebouncedCallback((v: string) => updateDay(date, (l) => void (l.note = v)), { delay: 600, flushOnUnmount: true });

  return (
    <Card p="sm" className={open ? undefined : 'later-card'}>
      <UnstyledButton onClick={() => setUnfolded(!unfolded)} disabled={!later || !!note || !!mood} style={{ width: '100%' }}>
        <Group justify="space-between" wrap="nowrap" px={4}>
          <div>
            <Text fw={800} fz={17}>
              📝 Reflect
            </Text>
            <Text size="xs" c="dimmed">
              {open ? 'How was today?' : 'Later · this evening'}
            </Text>
          </div>
          {!open && (
            <Badge variant="light" color="indigo">
              Tonight
            </Badge>
          )}
        </Group>
      </UnstyledButton>
      <Collapse expanded={open}>
      <Group justify="space-between" mt="xs" px={4} wrap="nowrap">
        {MOODS.map((m) => {
          const active = mood === m.value;
          return (
            <Tap
              key={m.value}
              aria-label={m.label}
              onClick={() => updateDay(date, (l) => void (l.mood = active ? undefined : m.value))}
              style={{ flex: 1, display: 'flex', justifyContent: 'center' }}
            >
              <motion.div
                animate={{ scale: active ? 1.18 : 1, opacity: mood && !active ? 0.35 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 28,
                  background: active ? 'var(--mantine-color-violet-light)' : 'transparent',
                }}
              >
                {m.emoji}
              </motion.div>
            </Tap>
          );
        })}
      </Group>
      <Textarea
        mt="sm"
        radius="md"
        autosize
        minRows={2}
        maxRows={6}
        label="How can I be better tomorrow?"
        placeholder="One thing to do better tomorrow…"
        value={value}
        onChange={(ev) => {
          setValue(ev.currentTarget.value);
          save(ev.currentTarget.value);
        }}
        onBlur={() => save.flush()}
      />
      </Collapse>
    </Card>
  );
}
