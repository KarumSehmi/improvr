import { Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Tap, accent } from './ui';

/** A one-line heads-up with an optional button: fines owed, a day still to lock in, a birthday. */
export default function Notice({ emoji, title, sub, color = 'orange', action }: { emoji: string; title: ReactNode; sub?: ReactNode; color?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="notice" style={accent(color)} role="status">
      <span className="notice-emoji">{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text fw={800} size="sm" lh={1.25}>
          {title}
        </Text>
        {sub && (
          <Text size="xs" c="dimmed" fw={600} mt={1}>
            {sub}
          </Text>
        )}
      </div>
      {action && (
        <Tap onClick={action.onClick} className="chip" style={{ color: 'white', background: 'var(--accent)', fontWeight: 800 }}>
          {action.label}
        </Tap>
      )}
    </div>
  );
}
