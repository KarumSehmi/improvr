import { Button, Card, Collapse, Group, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useUi } from '../lib/hooks';
import { ScoreRing, Tap, Tile } from './ui';

interface Props {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  done: number;
  total: number;
  quick?: { label: string; onClick: (e: MouseEvent) => void } | null;
  /** Not its time yet (e.g. "from 8pm"): starts folded away. */
  later?: string | null;
  children: ReactNode;
}

/** A checklist section that folds itself away once everything in it is done (or until its time comes). */
export default function SectionCard({ id, emoji, title, subtitle, color, done, total, quick, later, children }: Props) {
  const complete = total > 0 && done >= total;
  const [override, setOverride] = useState<boolean | null>(null);
  const state = `${complete}|${!!later}`;
  const [lastState, setLastState] = useState(state);
  if (lastState !== state) {
    setLastState(state);
    setOverride(null);
  }
  const open = override ?? (!complete && !later);

  // Tapped in the rail at the top: unfold.
  const wanted = useUi((s) => s.openSection === id);
  if (wanted && override !== true) setOverride(true);
  useEffect(() => {
    if (wanted) useUi.setState({ openSection: null });
  }, [wanted]);

  return (
    <Card
      id={`section-${id}`}
      p="sm"
      className={later && !open ? 'later-card' : undefined}
      style={complete ? { borderColor: 'var(--mantine-color-teal-outline)' } : undefined}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <UnstyledButton onClick={() => setOverride(!open)} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="sm" wrap="nowrap">
            <Tile emoji={complete ? '✅' : emoji} color={complete ? 'teal' : color} size={42} />
            <div style={{ minWidth: 0 }}>
              <Text fw={800} fz={17} lh={1.2}>
                {title}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {complete ? 'All done — nice.' : later ? `Later · ${later}` : subtitle}
              </Text>
            </div>
          </Group>
        </UnstyledButton>
        {quick && open && (
          <Tap onClick={quick.onClick}>
            <Button component="div" size="compact-sm" variant="light" color="teal">
              {quick.label}
            </Button>
          </Tap>
        )}
        <UnstyledButton onClick={() => setOverride(!open)} aria-label={open ? 'Collapse' : 'Expand'}>
          <Group gap={4} wrap="nowrap">
            <ScoreRing value={total ? (done / total) * 100 : 0} size={40} stroke={4} color={complete ? 'teal' : 'violet'}>
              <Text fz={11} fw={800}>
                {done}/{total}
              </Text>
            </ScoreRing>
            <IconChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms', opacity: 0.5 }} />
          </Group>
        </UnstyledButton>
      </Group>
      <Collapse expanded={open}>
        <div style={{ marginTop: 6 }}>{children}</div>
      </Collapse>
    </Card>
  );
}
