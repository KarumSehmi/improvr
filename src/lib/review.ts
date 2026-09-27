/** The weekly review's follow-up on the habit you chose to focus on. */
import type { HabitRate } from './engine';

/** What to say about last week's focus habit, and whether it's worth another week. */
export function focusOutcome(now: HabitRate, before: HabitRate | undefined): { text: string; color: string; keep: boolean } {
  if (!now.required) return { text: "It wasn't due last week, so there's nothing to judge.", color: 'gray', keep: false };
  const prev = before && before.required > 0 ? before.rate : null;
  if (now.rate >= 0.85) return { text: prev != null && now.rate > prev ? 'Nailed it — and up on the week before. Pick a new one.' : 'Nailed it. Pick a new one.', color: 'teal', keep: false };
  if (prev != null && now.rate > prev) return { text: 'Better than the week before. One more week and it sticks.', color: 'teal', keep: true };
  if (prev != null && now.rate < prev) return { text: 'Slipped back from the week before. Worth another go — pick a smaller step.', color: 'orange', keep: true };
  return { text: "No change on the week before. Try it again, but make it easier to start.", color: 'orange', keep: true };
}
