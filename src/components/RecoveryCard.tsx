import { Button, Card, Group, NumberInput, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { slipStats, type Summary } from '../lib/engine';
import { openSos } from '../lib/hooks';
import { NICOTINE_MILESTONES, recovery } from '../lib/recovery';
import { updateSettings, useApp } from '../lib/store';
import { Bar, PanelHead } from './ui';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What staying off nicotine is doing for you: where you are on the timeline, and what's next. */
export default function RecoveryCard({ summary }: { summary: Summary }) {
  const settings = useApp((s) => s.settings);
  const [editing, setEditing] = useState(false);
  if (!summary.habits.some((h) => h.id === 'vape')) return null;

  const days = summary.habitStreaks.vape?.current ?? 0;
  const r = recovery(days);
  const stats = slipStats(summary).find((s) => s.habit.id === 'vape');
  const perWeek = settings.costPerWeek?.vape ?? 0;
  const reason = settings.reasons?.vape ?? '';
  const from = r.latest?.days ?? 0;
  const pct = r.next ? ((days - from) / (r.next.days - from)) * 100 : 100;

  return (
    <Card p="md" id="recovery">
      <PanelHead
        emoji="🚭"
        color="teal"
        title="Nicotine-free"
        sub="What stopping is doing for you"
        right={
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Text fw={900} fz={32} lh={1} c="var(--good)" className="num">
              {days}
            </Text>
            <Text size="xs" c="dimmed" fw={600}>
              day{days === 1 ? '' : 's'}
            </Text>
          </div>
        }
      />

      <Group gap="sm" wrap="nowrap" mt="sm" px={4} align="flex-start">
        <Text fz={28} lh={1.1}>
          {r.latest?.emoji ?? '🌱'}
        </Text>
        <div style={{ minWidth: 0 }}>
          <Text fw={700} size="sm">
            {r.latest ? `${r.latest.title} in` : 'Day 0 — every streak starts here'}
          </Text>
          <Text size="xs" c="dimmed">
            {r.latest?.text ?? 'Get through today and nicotine starts clearing out of your system.'}
          </Text>
        </div>
      </Group>

      {r.next && (
        <div style={{ margin: '12px 4px 0' }}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" fw={700}>
              Next: {r.next.emoji} {r.next.title}
            </Text>
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              in {plural(r.inDays, 'day')}
            </Text>
          </Group>
          <div style={{ marginTop: 6 }}>
            <Bar value={pct} color="teal" />
          </div>
          <Text size="xs" c="dimmed" mt={4}>
            {r.next.text}
          </Text>
        </div>
      )}

      <div className="recovery-strip" aria-label="Milestones">
        {NICOTINE_MILESTONES.map((m) => {
          const reached = days >= m.days;
          return (
            <div key={m.days} className="recovery-step" data-reached={reached || undefined} data-next={m === r.next || undefined} title={`${m.title}: ${m.text}`}>
              <div className="recovery-dot">{reached ? m.emoji : ''}</div>
              <Text fz={10} fw={reached ? 800 : 600} c={reached ? undefined : 'dimmed'}>
                {m.short}
              </Text>
            </div>
          );
        })}
      </div>

      <div style={{ margin: '12px 4px 0' }}>
        {perWeek > 0 ? (
          <Text size="sm" fw={750} c="var(--good)">
            💰 £{stats?.saved ?? 0} kept in your pocket
            <Text span size="xs" c="dimmed" fw={500}>
              {' '}
              · £{Math.round(perWeek * 52).toLocaleString()} a year at £{perWeek}/week
            </Text>
          </Text>
        ) : (
          <NumberInput
            size="sm"
            label="What did nicotine cost you a week?"
            description="So you can see the money you're keeping"
            prefix="£"
            min={0}
            decimalScale={2}
            inputMode="decimal"
            placeholder="£0"
            onBlur={(e) => {
              const n = Number(e.currentTarget.value.replace(/[^0-9.]/g, ''));
              if (n > 0) updateSettings({ costPerWeek: { ...settings.costPerWeek, vape: n } });
            }}
          />
        )}
        {(stats?.urgesAll ?? 0) > 0 && (
          <Text size="xs" fw={600} c="grape.3" mt={4}>
            💪 {plural(stats?.urgesAll ?? 0, 'craving')} beaten so far
          </Text>
        )}
      </div>

      <div style={{ margin: '12px 4px 0' }}>
        <div className="eyebrow">Why you're doing this</div>
        {reason && !editing ? (
          <Text fw={700} size="sm" mt={4} onClick={() => setEditing(true)} style={{ cursor: 'text' }}>
            “{reason}”
          </Text>
        ) : (
          <Textarea
            mt={6}
            autosize
            minRows={1}
            placeholder="e.g. Better lungs for football, and £ back in my pocket"
            description="Shows on Today and when a craving hits"
            defaultValue={reason}
            onBlur={(e) => {
              updateSettings({ reasons: { ...settings.reasons, vape: e.currentTarget.value.trim() } });
              setEditing(false);
            }}
          />
        )}
      </div>

      <Button mt="md" fullWidth variant="light" color="teal" onClick={() => openSos('vape')}>
        🆘 Craving? Ride it out
      </Button>
    </Card>
  );
}
