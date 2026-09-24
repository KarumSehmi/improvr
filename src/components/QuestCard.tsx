import { Button, Card, Group, Text } from '@mantine/core';
import { IconArrowsShuffle } from '@tabler/icons-react';
import type { MouseEvent } from 'react';
import { BONUS } from '../lib/config';
import { burst } from '../lib/celebrate';
import type { DateKey } from '../lib/dates';
import { floatXp } from '../lib/feedback';
import { QUEST_SWAPS, questFor } from '../lib/moments';
import { updateDay } from '../lib/store';
import type { DayLog } from '../lib/types';
import { CheckCircle, Tap, Tile } from './ui';

/** One small optional challenge a day, for bonus XP. Different every day; you can swap it once. */
export default function QuestCard({ date, log }: { date: DateKey; log: DayLog | undefined }) {
  const swaps = log?.quest?.swap ?? 0;
  const done = !!log?.quest?.done;
  const quest = questFor(date, swaps);

  const toggle = (e: MouseEvent) => {
    if (!done) {
      burst();
      floatXp(e, `+${BONUS.quest}`);
    }
    updateDay(date, (l) => {
      l.quest = { ...l.quest, done: !done };
    });
  };

  return (
    <Card p="sm" className="quest" data-done={done || undefined}>
      <Group justify="space-between" px={4} wrap="nowrap">
        <div className="eyebrow">🎲 Bonus quest · +{BONUS.quest} XP</div>
        {!done && swaps < QUEST_SWAPS && (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconArrowsShuffle size={13} />}
            onClick={() =>
              updateDay(date, (l) => {
                l.quest = { ...l.quest, swap: swaps + 1 };
              })
            }
          >
            Swap
          </Button>
        )}
      </Group>
      <div className="hrow" data-state={done ? 'done' : undefined}>
        <Tap onClick={toggle} aria-label={quest.title}>
          <div className="hrow-main">
            <Tile emoji={quest.emoji} color="yellow" dim={done} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hrow-label">{quest.title}</div>
              <Text size="xs" c="dimmed">
                {done ? 'Quest complete — nice.' : quest.detail}
              </Text>
            </div>
            <CheckCircle checked={done} />
          </div>
        </Tap>
      </div>
    </Card>
  );
}
