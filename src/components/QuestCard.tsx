import { Card, Text, UnstyledButton } from '@mantine/core';
import { IconArrowsShuffle } from '@tabler/icons-react';
import { toggleQuest } from '../lib/actions';
import { BONUS } from '../lib/config';
import type { DateKey } from '../lib/dates';
import { QUEST_SWAPS, questFor } from '../lib/moments';
import { updateDay } from '../lib/store';
import type { DayLog } from '../lib/types';
import { CheckCircle, Tap, Tile } from './ui';

/** One small optional challenge a day, for bonus XP. Different every day; you can swap it once. */
export default function QuestCard({ date, log }: { date: DateKey; log: DayLog | undefined }) {
  const swaps = log?.quest?.swap ?? 0;
  const done = !!log?.quest?.done;
  const quest = questFor(date, swaps);

  return (
    <Card p="sm" px="md" className="quest" data-done={done || undefined}>
      <div className="hrow" data-state={done ? 'done' : undefined} style={{ padding: '4px 0' }}>
        <Tap onClick={(e) => toggleQuest(date, done, e)} aria-label={quest.title} aria-pressed={done}>
          <div className="hrow-main">
            <Tile emoji={quest.emoji} color="yellow" size={38} dim={done} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow" style={{ color: 'var(--mantine-color-yellow-5)' }}>
                🎲 Bonus quest · +{BONUS.quest} XP
              </div>
              <div className="hrow-label" style={{ marginTop: 2 }}>
                {quest.title}
              </div>
              <div className="hrow-meta">{done ? 'Quest complete — nice.' : quest.detail}</div>
            </div>
            <CheckCircle checked={done} color="yellow" />
          </div>
        </Tap>
      </div>
      {!done && swaps < QUEST_SWAPS && (
        <UnstyledButton
          onClick={() =>
            updateDay(date, (l) => {
              l.quest = { ...l.quest, swap: swaps + 1 };
            })
          }
          style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0 2px 50px' }}
        >
          <IconArrowsShuffle size={13} style={{ opacity: 0.6 }} />
          <Text size="xs" fw={700} c="dimmed">
            Not feeling it? Swap it (once)
          </Text>
        </UnstyledButton>
      )}
    </Card>
  );
}
