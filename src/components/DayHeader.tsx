import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { addDays, fmt, range, type DateKey } from '../lib/dates';
import { featureOn } from '../lib/config';
import { isOpen, type Summary } from '../lib/engine';
import { goTo, logDate, openDay, openSos, useNow } from '../lib/hooks';
import { daypart, logicalNow, type Daypart } from '../lib/moments';
import { ScoreRing, Tap } from './ui';

const GREETING: Record<Daypart, [emoji: string, text: string]> = {
  dawn: ['🌄', 'Early start'],
  morning: ['🌅', 'Morning'],
  day: ['☀️', 'Afternoon'],
  evening: ['🌆', 'Evening'],
  night: ['🌙', 'Evening'],
};

/** Date, greeting, the craving button and your level. */
export function DayHeader({ date, summary }: { date: DateKey; summary: Summary }) {
  const now = useNow();
  const clock = new Date(now);
  const live = logicalNow(clock).date === date;
  const { level, settings } = summary;
  const [emoji, hello] = clock.getHours() < 4 ? ['🦉', 'Still up'] : GREETING[daypart(clock)];
  const d = Number(fmt(date, 'D'));
  const title = live ? `${hello}${settings.name ? `, ${settings.name}` : ''}` : date === addDays(summary.today, -1) ? 'Yesterday' : fmt(date, 'dddd');
  const sos = featureOn(settings, 'sos') && summary.habits.some((h) => h.kind === 'avoid');

  return (
    <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow">
          {live ? `${emoji} ` : ''}
          {fmt(date, 'dddd')} {d} {fmt(date, 'MMMM')}
        </div>
        <Text component="h1" className="page-title" mt={4} fz={title.length > 15 ? 25 : undefined} lineClamp={2}>
          {title}
        </Text>
      </div>
      <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
        {sos && (
          <Tap
            onClick={() => openSos()}
            aria-label="Craving SOS"
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              background: 'color-mix(in srgb, var(--mantine-color-red-6) 16%, var(--surface))',
              border: '1px solid color-mix(in srgb, var(--mantine-color-red-6) 35%, transparent)',
            }}
          >
            🆘
          </Tap>
        )}
        <UnstyledButton onClick={() => goTo('progress')} aria-label={`Level ${level.level}`}>
          <ScoreRing value={(level.into / level.need) * 100} size={50} stroke={4.5} color="teal">
            <Stack gap={0} align="center">
              <Text fz={8.5} fw={850} c="dimmed" lh={1} lts={0.5}>
                LVL
              </Text>
              <Text fz={17} fw={900} lh={1} className="num">
                {level.level}
              </Text>
            </Stack>
          </ScoreRing>
        </UnstyledButton>
      </Group>
    </Group>
  );
}

/** The last 7 days with their scores. Tap one to fill it in; a dot means it still needs locking in. */
export function WeekStrip({ selected, summary }: { selected: DateKey; summary: Summary }) {
  const { today } = summary;
  // The day Today shows by itself (still last night just after midnight, if that isn't locked in yet).
  const home = logDate(useNow(), summary);
  return (
    <div className="week" role="tablist" aria-label="Pick a day">
      {range(addDays(today, -6), today).map((d) => {
        const e = summary.evalByDate[d];
        const open = isOpen(d, today);
        const flag = e && !e.closed && !e.dayOff && d !== today ? (open ? 'warn' : 'bad') : null;
        const pct = e?.dayOff ? 100 : (e?.pct ?? 0);
        const color = e?.dayOff ? 'blue' : e?.perfect ? 'teal' : 'brand';
        return (
          <Tap
            key={d}
            className="week-day"
            data-selected={d === selected || undefined}
            data-disabled={!e || undefined}
            onClick={() => openDay(d === home ? null : d)}
            role="tab"
            aria-selected={d === selected}
            aria-label={`${fmt(d, 'dddd D MMMM')}${e?.pct != null ? `, ${e.pct}%` : ''}${flag === 'warn' ? ', not locked in' : flag === 'bad' ? ', missed' : ''}`}
          >
            <span className="week-day-name">{d === today ? 'Today' : fmt(d, 'ddd')}</span>
            <ScoreRing value={e ? pct : 0} size={36} stroke={3.5} color={color}>
              <Text fz={13} fw={d === selected ? 900 : 750} className="num" lh={1}>
                {e?.dayOff ? '🏖' : Number(d.slice(8))}
              </Text>
            </ScoreRing>
            {flag && <span className="week-day-flag" data-tone={flag === 'bad' ? 'bad' : undefined} />}
          </Tap>
        );
      })}
    </div>
  );
}
