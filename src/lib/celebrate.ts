import confetti from 'canvas-confetti';

const base = { disableForReducedMotion: true, zIndex: 10000 };

/** Small pop from where you tapped. */
export function pop(event?: { clientX: number; clientY: number }) {
  const origin = event
    ? { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight }
    : { x: 0.5, y: 0.6 };
  void confetti({ ...base, particleCount: 28, spread: 55, startVelocity: 22, scalar: 0.7, ticks: 90, origin });
}

/** Section finished. */
export function burst() {
  void confetti({ ...base, particleCount: 90, spread: 80, origin: { y: 0.65 } });
}

/** Perfect day / big milestone. */
export function fireworks() {
  const end = Date.now() + 1600;
  const colors = ['#9775fa', '#f06595', '#ffd43b', '#38d9a9'];
  (function frame() {
    void confetti({ ...base, particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors });
    void confetti({ ...base, particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
