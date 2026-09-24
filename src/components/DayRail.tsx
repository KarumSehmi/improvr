import { Text } from '@mantine/core';
import { SECTIONS } from '../lib/config';
import { scrollToAndFlash } from '../lib/actions';
import type { DayEval } from '../lib/engine';
import { useUi } from '../lib/hooks';
import { sectionLater, sectionStatus } from '../lib/moments';
import { ScoreRing, Tap } from './ui';

const SHORT: Record<string, string> = { morning: 'Morning', day: 'Day', room: 'Jobs', night: 'Night', clean: 'Clean' };

/** The whole day at a glance: one ring per section (plus training). Tap one to jump to it. */
export default function DayRail({ e, hour, live, sessions, target }: { e: DayEval; hour: number; live: boolean; sessions: number; target: number }) {
  const go = (id: string, section?: string) => {
    if (section) useUi.setState({ openSection: section });
    setTimeout(() => scrollToAndFlash(id), 60);
  };

  return (
    <div className="rail">
      {SECTIONS.map((sec) => {
        const { items, total, done, open, complete, closed } = sectionStatus(e, sec.id);
        if (!items.length) return null;
        const later = live && !closed && sectionLater(sec.id, hour);
        return (
          <Tap key={sec.id} className="rail-item" data-later={later || undefined} onClick={() => go(`section-${sec.id}`, sec.id)} aria-label={sec.title}>
            <ScoreRing value={total ? (done / total) * 100 : 100} size={48} stroke={4} color={complete ? 'teal' : 'violet'}>
              <Text fz={20} lh={1}>
                {complete ? '✅' : sec.emoji}
              </Text>
            </ScoreRing>
            <Text fz={10.5} fw={800} lh={1.1}>
              {SHORT[sec.id]}
            </Text>
            <Text fz={10} c={complete ? 'teal.4' : closed || later ? 'dimmed' : 'orange.4'} fw={700} lh={1.1}>
              {complete ? 'done' : closed ? 'closed' : later ? 'later' : `${open.length} left`}
            </Text>
          </Tap>
        );
      })}
      <Tap className="rail-item" onClick={() => go('training')} aria-label="Training">
        <ScoreRing value={Math.min(100, (sessions / target) * 100)} size={48} stroke={4} color={sessions >= target ? 'teal' : 'violet'}>
          <Text fz={20} lh={1}>
            {sessions >= target ? '💪' : '🏋️'}
          </Text>
        </ScoreRing>
        <Text fz={10.5} fw={800} lh={1.1}>
          Train
        </Text>
        <Text fz={10} c="dimmed" fw={600} lh={1.1}>
          {sessions}/{target} wk
        </Text>
      </Tap>
    </div>
  );
}
