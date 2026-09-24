import { Badge, Card, Collapse, Group, Progress, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';

interface Props {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  done: number;
  total: number;
  children: ReactNode;
}

/** A checklist section that folds itself away once everything in it is done. */
export default function SectionCard({ id, emoji, title, subtitle, done, total, children }: Props) {
  const complete = total > 0 && done >= total;
  const [override, setOverride] = useState<boolean | null>(null);
  const [wasComplete, setWasComplete] = useState(complete);
  if (wasComplete !== complete) {
    setWasComplete(complete);
    setOverride(null);
  }
  const open = override ?? !complete;

  return (
    <Card id={`section-${id}`} p="sm" radius="lg" style={complete ? { borderColor: 'var(--mantine-color-teal-outline)' } : undefined}>
      <UnstyledButton onClick={() => setOverride(!open)} w="100%">
        <Group justify="space-between" wrap="nowrap" px={4}>
          <Group gap="sm" wrap="nowrap">
            <Text fz={24}>{complete ? '✅' : emoji}</Text>
            <div>
              <Text fw={800} lh={1.2}>
                {title}
              </Text>
              <Text size="xs" c="dimmed">
                {complete ? 'All done — nice.' : subtitle}
              </Text>
            </div>
          </Group>
          <Group gap={6} wrap="nowrap">
            <Badge variant={complete ? 'filled' : 'light'} color={complete ? 'teal' : 'gray'} size="lg">
              {done}/{total}
            </Badge>
            <IconChevronDown
              size={18}
              style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms', opacity: 0.6 }}
            />
          </Group>
        </Group>
      </UnstyledButton>
      <Progress value={total ? (done / total) * 100 : 0} size={4} mt="sm" color={complete ? 'teal' : 'violet'} radius="xl" />
      <Collapse expanded={open}>
        <Stack gap={6} mt="sm">
          {children}
        </Stack>
      </Collapse>
    </Card>
  );
}
