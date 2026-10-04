import { Card, Collapse, Group, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useUi } from '../lib/hooks';
import type { SectionStatus } from '../lib/moments';
import { Bar, Tap, Tile, accent } from './ui';

interface Props {
  id: string;
  emoji: string;
  title: string;
  subtitle: ReactNode;
  color: string;
  status: SectionStatus;
  quick?: { label: string; onClick: (e: MouseEvent) => void } | null;
  /** Not its time yet (e.g. "from 8pm"): starts folded away. */
  later?: string | null;
  /** "Didn't do the rest": marks what's left as not done so the section closes. */
  onCloseRest?: (() => void) | null;
  /** The day's locked in: everything folds away. */
  dayClosed?: boolean;
  /** Rows, so finished ones can be tucked away when "Hide done" is on. */
  rows: { id: string; done: boolean; node: ReactNode }[];
  /** Extra bits under the rows (e.g. the craving button). */
  footer?: ReactNode;
}

/**
 * A checklist section. It folds itself away once everything in it is answered — done or not
 * (a missed bedtime shouldn't keep it open all day) — and until its time comes.
 */
export default function SectionCard({ id, emoji, title, subtitle, color, status, quick, later, onCloseRest, dayClosed, rows, footer }: Props) {
  const { total, done, missed, open: left, complete, closed } = status;
  const hideDone = useUi((s) => s.hideDone);
  const [reveal, setReveal] = useState(false);
  const [override, setOverride] = useState<boolean | null>(null);
  const state = `${complete}|${closed}|${!!later}|${!!dayClosed}`;
  const [lastState, setLastState] = useState(state);
  if (lastState !== state) {
    setLastState(state);
    setOverride(null);
  }
  const open = override ?? (!closed && !later && !dayClosed);

  // Tapped in the hero at the top: unfold.
  const wanted = useUi((s) => s.openSection === id);
  if (wanted && override !== true) setOverride(true);
  useEffect(() => {
    if (wanted) useUi.setState({ openSection: null });
  }, [wanted]);

  const line = complete
    ? 'All done — nice.'
    : closed
      ? `Closed · ${missed} ${id === 'clean' ? 'slipped' : 'not done'}`
      : dayClosed
        ? `Locked in · ${left.length} not done`
        : later
          ? `Later · ${later}`
          : subtitle;

  const shown = hideDone && !reveal ? rows.filter((r) => !r.done) : rows;
  const tucked = rows.length - shown.length;
  const toggle = () => setOverride(!open);

  return (
    <Card id={`section-${id}`} p="sm" px="md" className={later && !open ? 'later-card' : undefined} style={{ ...accent(color), scrollMarginTop: 90 }}>
      <Group justify="space-between" wrap="nowrap" gap="xs" py={2}>
        <UnstyledButton onClick={toggle} style={{ flex: 1, minWidth: 0 }} aria-expanded={open}>
          <Group gap={12} wrap="nowrap">
            <Tile emoji={complete ? '✅' : emoji} color={complete ? 'teal' : color} size={38} dim={closed && !complete} />
            <div style={{ minWidth: 0 }}>
              <div className="panel-title">{title}</div>
              <Text className="panel-sub" truncate>
                {line}
              </Text>
            </div>
          </Group>
        </UnstyledButton>
        {quick && open && (
          <Tap onClick={quick.onClick} className="chip" style={{ height: 30, color: 'var(--accent-text)', background: 'var(--accent-soft)' }}>
            {quick.label}
          </Tap>
        )}
        <UnstyledButton onClick={toggle} aria-label={open ? `Fold ${title}` : `Unfold ${title}`}>
          <Group gap={6} wrap="nowrap">
            <Text fz={13} fw={850} className="num" c={complete ? 'var(--good)' : 'dimmed'}>
              {done}/{total}
            </Text>
            <IconChevronDown size={17} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms', opacity: 0.45 }} />
          </Group>
        </UnstyledButton>
      </Group>
      <div style={{ margin: '8px 0 2px' }}>
        <Bar value={total ? (done / total) * 100 : 0} color={complete ? 'teal' : color} h={4} />
      </div>
      <Collapse expanded={open}>
        <div style={{ marginTop: 4 }}>{shown.map((r) => r.node)}</div>
        {tucked > 0 && (
          <UnstyledButton onClick={() => setReveal(true)} w="100%" py={8}>
            <Text size="xs" fw={750} c="dimmed" ta="center">
              ✓ {tucked} done · show
            </Text>
          </UnstyledButton>
        )}
        {footer}
        {onCloseRest && (
          <UnstyledButton onClick={onCloseRest} w="100%" pt={6} pb={4}>
            <Text size="xs" fw={700} c="dimmed" ta="center">
              Didn't do the rest? Close it
            </Text>
          </UnstyledButton>
        )}
      </Collapse>
    </Card>
  );
}
