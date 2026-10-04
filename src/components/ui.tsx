/** Small shared building blocks: haptic taps, animated checks, emoji tiles, rings, sheets and "+XP" pop-ups. */
import { Box, Button, CopyButton, Drawer, Group, Text, TextInput, type BoxProps, type ElementProps } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconCopy, IconMinus, IconPlus } from '@tabler/icons-react';
import { hapticTrigger } from 'ios-haptics';
import { AnimatePresence, motion } from 'motion/react';
import { Children, useId, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { fmt, type DateKey } from '../lib/dates';
import { useFloaters } from '../lib/feedback';
import type { HistoryState } from '../lib/trend';

/** CSS variables for an accent colour (a Mantine colour name), used by tiles, checks, bars and chips. */
export function accent(color: string): CSSProperties {
  return {
    '--accent': `var(--mantine-color-${color}-filled)`,
    '--accent-soft': `var(--mantine-color-${color}-light)`,
    '--accent-text': `var(--mantine-color-${color}-light-color)`,
  } as CSSProperties;
}

// Scrolling on a phone often ends on a row. Anything that moved, or landed during or just after a
// scroll (e.g. the tap that stops a flick), isn't a real tap.
const MOVE_PX = 10;
const SETTLE_MS = 300;
const LONG_MS = 480;
let lastScroll = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => (lastScroll = performance.now()), { capture: true, passive: true });
}

type TapProps = BoxProps &
  ElementProps<'div', 'onClick'> & {
    onClick: (e: MouseEvent) => void;
    /** Press and hold (or right-click on a computer) for more options. */
    onLongPress?: () => void;
    children: ReactNode;
    style?: CSSProperties;
  };

/**
 * A tap target that buzzes on iPhone. Put the click handler here, not on children:
 * on iOS the tap lands on an invisible switch (that's what makes the haptic) and bubbles up to this box.
 * Taps that were really part of a scroll are ignored. Works with the keyboard too (Enter / Space).
 */
export function Tap({ onClick, onLongPress, children, style, ...rest }: TapProps) {
  const press = useRef<{ x: number; y: number; at: number; moved: boolean; long: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const el = useRef<HTMLDivElement | null>(null);
  const stopTimer = () => clearTimeout(timer.current);

  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        el.current = node;
        hapticTrigger(node);
      }}
      onPointerDown={(e) => {
        press.current = { x: e.clientX, y: e.clientY, at: performance.now(), moved: false, long: false };
        if (onLongPress) {
          stopTimer();
          el.current?.setAttribute('data-pressing', '');
          timer.current = setTimeout(() => {
            if (!press.current || press.current.moved) return;
            press.current.long = true;
            el.current?.removeAttribute('data-pressing');
            navigator.vibrate?.(12);
            onLongPress();
          }, LONG_MS);
        }
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_PX) {
          p.moved = true;
          stopTimer();
          el.current?.removeAttribute('data-pressing');
        }
      }}
      onPointerUp={() => {
        stopTimer();
        el.current?.removeAttribute('data-pressing');
      }}
      onPointerCancel={() => {
        if (press.current) press.current.moved = true;
        stopTimer();
        el.current?.removeAttribute('data-pressing');
      }}
      onContextMenu={(e: MouseEvent) => {
        if (!onLongPress) return;
        e.preventDefault();
        if (press.current?.long) return; // the hold already opened it
        onLongPress();
      }}
      onClick={(e: MouseEvent) => {
        const p = press.current;
        press.current = null;
        if (p && (p.moved || p.long || lastScroll > p.at - SETTLE_MS)) {
          e.preventDefault(); // also flips the hidden switch back, so no buzz
          e.stopPropagation();
          return;
        }
        onClick(e);
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onClick({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 } as MouseEvent);
        }
        if (onLongPress && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) {
          e.preventDefault();
          onLongPress();
        }
      }}
      role="button"
      tabIndex={0}
      style={{ position: 'relative', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', outlineOffset: 2, ...style }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** `idle` shows a faint ✓ or ✕ before anything's chosen. `color` tints the tick (the part of the day it belongs to). */
export function CheckCircle({ checked, missed, idle, size = 28, color }: { checked: boolean; missed?: boolean; idle?: 'check' | 'x'; size?: number; color?: string }) {
  const fill = checked
    ? color
      ? `linear-gradient(140deg, var(--mantine-color-${color}-4), var(--mantine-color-${color}-6))`
      : 'linear-gradient(140deg, var(--mantine-color-teal-4), var(--mantine-color-green-6))'
    : missed
      ? 'linear-gradient(140deg, var(--mantine-color-red-5), var(--mantine-color-pink-6))'
      : 'transparent';
  const glow = color ? `color-mix(in srgb, var(--mantine-color-${color}-5) 45%, transparent)` : 'rgba(18, 184, 134, 0.45)';
  return (
    <motion.div
      initial={false}
      animate={{ scale: checked ? [1, 1.25, 0.95, 1] : 1 }}
      transition={{ duration: 0.38 }}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 999,
        display: 'grid',
        placeItems: 'center',
        background: fill,
        border: checked || missed ? 'none' : '2px solid var(--ring-idle)',
        boxShadow: checked ? `0 4px 14px ${glow}` : undefined,
        transition: 'background 160ms, box-shadow 160ms',
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} aria-hidden>
        {missed && !checked ? (
          <path d="M7 7l10 10M17 7L7 17" stroke="white" strokeWidth={3} strokeLinecap="round" />
        ) : idle === 'x' ? (
          <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" stroke="var(--ring-idle)" strokeWidth={2.6} strokeLinecap="round" />
        ) : idle === 'check' && !checked ? (
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="var(--ring-idle)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="white"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
          />
        )}
      </svg>
    </motion.div>
  );
}

/** iOS-settings style emoji icon, tinted with its colour. */
export function Tile({ emoji, color, size = 36, dim }: { emoji: string; color?: string; size?: number; dim?: boolean }) {
  return (
    <div
      className="tile"
      data-dim={dim || undefined}
      style={{ width: size, height: size, borderRadius: size * 0.31, fontSize: size * 0.52, ...(color ? accent(color) : null) }}
    >
      {emoji}
    </div>
  );
}

const RING: Record<string, [string, string]> = {
  brand: ['var(--mantine-color-violet-4)', 'var(--mantine-color-pink-5)'],
  teal: ['#38d9a9', '#20c997'],
  blue: ['#4dabf7', '#748ffc'],
};

/** Progress ring with a gradient and an optional notch (yesterday's score). `color` is a Mantine colour or 'brand'. */
export function ScoreRing({
  value,
  marker,
  size = 128,
  stroke = 12,
  children,
  color = 'brand',
}: {
  value: number;
  marker?: number | null;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  color?: string;
}) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [from, to] = RING[color === 'violet' ? 'brand' : color] ?? [`var(--mantine-color-${color}-4)`, `var(--mantine-color-${color}-6)`];
  const markerAngle = marker != null ? (marker / 100) * 2 * Math.PI - Math.PI / 2 : null;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }} aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: from }} />
            <stop offset="100%" style={{ stopColor: to }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <motion.circle
          style={{ opacity: value > 0 ? 1 : 0 }}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(100, Math.max(value, 0.001)) / 100) }}
          transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        />
      </svg>
      {markerAngle != null && (
        <div
          title="Yesterday"
          style={{
            position: 'absolute',
            width: 9,
            height: 9,
            borderRadius: 99,
            background: 'var(--mantine-color-yellow-4)',
            boxShadow: '0 0 0 2.5px var(--surface)',
            left: size / 2 + r * Math.cos(markerAngle) - 4.5,
            top: size / 2 + r * Math.sin(markerAngle) - 4.5,
          }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

/** A thin progress line in the accent colour. */
export function Bar({ value, color, h = 6 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="bar" style={{ height: h, ...(color ? accent(color) : null) }}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** The small grey line under a row: bits separated by dots. Children that are falsy are skipped. */
export function Meta({ children }: { children: ReactNode }) {
  const parts = Children.toArray(children).filter(Boolean);
  if (!parts.length) return null;
  return <div className="hrow-meta">{parts}</div>;
}

/** One bit of a meta line, optionally coloured: warn, bad, good, streak, accent. */
export function M({ children, tone }: { children: ReactNode; tone?: 'warn' | 'bad' | 'good' | 'streak' | 'accent' }) {
  return <span data-tone={tone}>{children}</span>;
}

/** Card header: icon tile, title and subtitle, and whatever goes on the right. */
export function PanelHead({ emoji, color, title, sub, right, onClick }: { emoji?: string; color?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const left = (
    <Group gap={12} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
      {emoji && <Tile emoji={emoji} color={color} size={38} />}
      <div style={{ minWidth: 0 }}>
        <div className="panel-title">{title}</div>
        {sub && <div className="panel-sub">{sub}</div>}
      </div>
    </Group>
  );
  return (
    <div className="panel-head">
      {onClick ? (
        <Box component="button" type="button" onClick={onClick} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}>
          {left}
        </Box>
      ) : (
        left
      )}
      {right}
    </div>
  );
}

/** Two-answer switch, e.g. Slipped / Clean or No / Yes. */
export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null | undefined;
  options: { value: T; label: ReactNode; tone: 'good' | 'bad' | 'warn'; aria?: string }[];
  onChange: (v: T, e: MouseEvent) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <Tap key={o.value} className="seg-btn" data-on={value === o.value || undefined} data-tone={o.tone} onClick={(e) => onChange(o.value, e)} aria-label={o.aria} aria-pressed={value === o.value}>
          {o.label}
        </Tap>
      ))}
    </div>
  );
}

/** − 3/10 + */
export function Stepper({ value, target, unit, color, onChange }: { value: number; target?: number; unit?: string; color?: string; onChange: (delta: number, e: MouseEvent) => void }) {
  return (
    <div className="stepper" style={color ? accent(color) : undefined}>
      <Tap className="stepper-btn" onClick={(e) => value > 0 && onChange(-1, e)} aria-label="One less">
        <IconMinus size={16} stroke={2.4} />
      </Tap>
      <div className="stepper-val">
        {value}
        {target ? <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>/{target}</span> : null}
        {unit && !target ? <span style={{ color: 'var(--text-3)', fontWeight: 650, fontSize: 12 }}> {unit}</span> : null}
      </div>
      <Tap className="stepper-btn" data-primary onClick={(e) => onChange(1, e)} aria-label="One more">
        <IconPlus size={16} stroke={2.6} />
      </Tap>
    </div>
  );
}

/** Bottom sheet on a phone, side panel on a computer. */
export function Sheet({
  opened,
  onClose,
  title,
  children,
  size,
  zIndex,
}: {
  opened: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Desktop width (defaults to 'md'). */
  size?: string;
  zIndex?: number;
}) {
  const wide = useMediaQuery('(min-width: 48em)');
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position={wide ? 'right' : 'bottom'}
      size={wide ? (size ?? 'md') : 'auto'}
      radius={wide ? 0 : undefined}
      withCloseButton={!!title || !!wide}
      title={title ? <span className="sheet-title">{title}</span> : undefined}
      zIndex={zIndex}
      classNames={{ content: wide ? 'sheet-content' : 'sheet-content sheet-bottom', header: 'sheet-header', body: 'sheet-body' }}
      transitionProps={{ duration: 220, timingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      lockScroll
    >
      {!wide && !title && <div className="sheet-handle" />}
      {children}
    </Drawer>
  );
}

const DOT_LABEL: Record<HistoryState, string> = { done: 'done', missed: 'missed', open: 'still open', none: 'not due', off: 'day off' };

/** A habit's last days as a row of dots, today on the right. */
export function WeekDots({ days, color }: { days: { date: DateKey; state: HistoryState }[]; color?: string }) {
  return (
    <div className="dots" style={color ? accent(color) : undefined} aria-label={days.map((d) => `${fmt(d.date, 'ddd')}: ${DOT_LABEL[d.state]}`).join(', ')}>
      {days.map((d) => (
        <span key={d.date} className="dot" data-state={d.state} title={`${fmt(d.date, 'ddd D MMM')} · ${DOT_LABEL[d.state]}`} />
      ))}
    </div>
  );
}

export function FloaterLayer() {
  const items = useFloaters((s) => s.items);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10001 }}>
      <AnimatePresence>
        {items.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -64, scale: 1.1 }}
            transition={{ duration: 0.95, ease: 'easeOut' }}
            style={{ position: 'absolute', left: f.x - 40, top: f.y - 28, width: 80, textAlign: 'center' }}
          >
            <Text fw={900} fz={18} c="var(--xp)" style={{ textShadow: '0 2px 10px rgba(0,0,0,.35)' }}>
              {f.text}
            </Text>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** A read-only field with a Copy button (keys and links for set-up steps). */
export function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-end">
      <TextInput label={label} value={value} readOnly size="sm" style={{ flex: 1 }} onFocus={(e) => e.currentTarget.select()} />
      <CopyButton value={value}>
        {({ copied, copy }) => (
          <Button size="sm" variant="light" color={copied ? 'teal' : 'violet'} leftSection={<IconCopy size={14} />} onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </CopyButton>
    </Group>
  );
}
