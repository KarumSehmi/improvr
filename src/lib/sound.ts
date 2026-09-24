/**
 * Tiny synthesized sounds (no audio files to load). The iPhone's silent switch mutes them,
 * and they can be switched off in More → Settings.
 */
import { useApp } from './store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (useApp.getState().settings.sounds === false) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(a: AudioContext, freq: number, delay: number, length: number, volume: number, type: OscillatorType = 'sine') {
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

function play(notes: [freq: number, delay: number, length: number, volume: number, type?: OscillatorType][]) {
  const a = audio();
  if (!a) return;
  for (const [f, d, l, v, t] of notes) note(a, f, d, l, v, t);
}

export const sound = {
  /** A soft pop for each tick. */
  tick: () =>
    play([
      [660, 0, 0.09, 0.05, 'triangle'],
      [990, 0.035, 0.13, 0.035],
    ]),
  /** A section finished, or a check-in. */
  chime: () =>
    play([
      [784, 0, 0.35, 0.045],
      [988, 0.07, 0.35, 0.045],
      [1319, 0.14, 0.5, 0.04],
    ]),
  /** Perfect day, level up. */
  fanfare: () => play([523, 659, 784, 1047, 1319].map((f, i) => [f, i * 0.085, 0.55, 0.045, 'triangle'])),
  /** The reward chest opening. */
  sparkle: () => play([1568, 1760, 2093, 2349, 2637, 3136].map((f, i) => [f, i * 0.045, 0.3, 0.022])),
};
