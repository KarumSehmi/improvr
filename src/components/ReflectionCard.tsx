import { Card, Group, Text, Textarea } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { motion } from 'motion/react';
import { useState } from 'react';
import { MOODS } from '../lib/config';
import type { DateKey } from '../lib/dates';
import { updateDay } from '../lib/store';
import { Tap } from './ui';

export default function ReflectionCard({ date, note, mood }: { date: DateKey; note: string; mood: number | undefined }) {
  const [value, setValue] = useState(note);
  const [editingDate, setEditingDate] = useState(date);
  if (editingDate !== date) {
    setEditingDate(date);
    setValue(note);
  }
  const save = useDebouncedCallback((v: string) => updateDay(date, (l) => void (l.note = v)), { delay: 600, flushOnUnmount: true });

  return (
    <Card p="sm">
      <Text fw={800} fz={17} px={4}>
        📝 Reflect
      </Text>
      <Text size="xs" c="dimmed" px={4}>
        How was today?
      </Text>
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
    </Card>
  );
}
