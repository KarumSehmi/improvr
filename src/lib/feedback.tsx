/** Feedback helpers: "+15 XP" pop-ups and Undo toasts. */
import { Button, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// "+15 XP" floating up from where you tapped
// ---------------------------------------------------------------------------

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
}

export const useFloaters = create<{ items: Floater[] }>()(() => ({ items: [] }));
let nextFloat = 0;

export function floatXp(e: { clientX: number; clientY: number } | undefined, text: string) {
  const x = e?.clientX ?? window.innerWidth / 2;
  const y = e?.clientY ?? window.innerHeight / 2;
  const id = nextFloat++;
  useFloaters.setState((s) => ({ items: [...s.items, { id, x, y, text }] }));
  setTimeout(() => useFloaters.setState((s) => ({ items: s.items.filter((f) => f.id !== id) })), 1000);
}

/** Toast with an Undo button — for one-tap bulk actions. */
export function notifyUndo(title: string, undo: () => void) {
  const id = `undo-${Date.now()}`;
  notifications.show({
    id,
    color: 'teal',
    autoClose: 4000,
    message: (
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={600}>
          {title}
        </Text>
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => {
            undo();
            notifications.hide(id);
          }}
        >
          Undo
        </Button>
      </Group>
    ),
  });
}
