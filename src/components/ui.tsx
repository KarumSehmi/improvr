/** Small shared building blocks: haptic taps, animated check, emoji tiles, the score ring and "+XP" pop-ups. */
import { Box, Button, CopyButton, Group, Text, TextInput, type BoxProps, type ElementProps } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import { hapticTrigger } from 'ios-haptics';
import { AnimatePresence, motion } from 'motion/react';
import { useId, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useFloaters } from '../lib/feedback';

/**
 * A tap target that buzzes on iPhone. Put the click handler here, not on children:
 * on iOS the tap lands on an invisible switch (that's what makes the haptic) and bubbles up to this box.
 */
export function Tap({
  onClick,
  children,
  style,
  ...rest
}: BoxProps & ElementProps<'div', 'onClick'> & { onClick: (e: MouseEvent) => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <Box
      ref={hapticTrigger}
      onClick={onClick}
      role="button"
      style={{ position: 'relative', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', ...style }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** `idle` shows a faint ✓ or ✕ before anything's chosen, so yes/no pairs are obvious. */
export function CheckCircle({ checked, missed, idle, size = 30 }: { checked: boolean; missed?: boolean; idle?: 'check' | 'x'; size?: number }) {
  const fill = checked
    ? 'linear-gradient(135deg, var(--mantine-color-teal-4), var(--mantine-color-green-6))'
    : missed
      ? 'linear-gradient(135deg, var(--mantine-color-red-5), var(--mantine-color-pink-6))'
      : 'transparent';
  return (
    <motion.div
      initial={false}
      animate={{ scale: checked ? [1, 1.28, 0.94, 1] : 1 }}
      transition={{ duration: 0.4 }}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 999,
        display: 'grid',
        placeItems: 'center',
        background: fill,
        border: checked || missed ? 'none' : '2px solid var(--ring-idle)',
        boxShadow: checked ? '0 4px 16px rgba(18, 184, 134, 0.45)' : undefined,
        transition: 'background 160ms',
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
            transition={{ duration: 0.28, ease: 'easeOut' }}
          />
        )}
      </svg>
    </motion.div>
  );
}

/** iOS-settings style emoji icon. */
export function Tile({ emoji, color, size = 38, dim }: { emoji: string; color: string; size?: number; dim?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size * 0.3,
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.52,
        background: `var(--mantine-color-${color}-light)`,
        filter: dim ? 'saturate(0.4)' : undefined,
        opacity: dim ? 0.7 : 1,
        transition: 'filter 200ms, opacity 200ms',
      }}
    >
      {emoji}
    </div>
  );
}

/** Big progress ring with a gradient and a notch marking yesterday's score. */
export function ScoreRing({ value, marker, size = 128, stroke = 12, children, color }: { value: number; marker?: number | null; size?: number; stroke?: number; children?: ReactNode; color?: 'violet' | 'teal' | 'blue' }) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [from, to] = color === 'teal' ? ['#38d9a9', '#20c997'] : color === 'blue' ? ['#4dabf7', '#748ffc'] : ['#9775fa', '#f06595'];
  const markerAngle = marker != null ? (marker / 100) * 2 * Math.PI - Math.PI / 2 : null;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
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
            width: 8,
            height: 8,
            borderRadius: 99,
            background: 'var(--mantine-color-yellow-4)',
            boxShadow: '0 0 0 2px var(--mantine-color-body)',
            left: size / 2 + r * Math.cos(markerAngle) - 4,
            top: size / 2 + r * Math.sin(markerAngle) - 4,
          }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
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
            <Text fw={900} fz={18} c="yellow.4" style={{ textShadow: '0 2px 10px rgba(0,0,0,.5)' }}>
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
