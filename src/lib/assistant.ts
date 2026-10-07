/**
 * The chat assistant: what Claude is told and the tools it can use. Shared by the server
 * (api/chat.ts, which talks to Claude) and the app (which runs the tools on your data).
 *
 * The system prompt and tools never change mid-chat (Claude's thinking is tied to them), so
 * anything that changes — the time, your to-dos — goes into each message's <app_context> instead.
 * Imports end in .js because this file also runs on the server.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { EVENT_COLORS } from './calendar.js';

export const ASSISTANT_MODEL = 'claude-sonnet-5-5';

/** Most messages in one chat (each tool round is two) — start a new chat after that. */
export const MAX_MESSAGES = 120;

/** Biggest chat the server takes, as JSON (each message carries your to-dos and calendar, so this adds up). */
export const MAX_CHAT_CHARS = 500_000;

/** Tool rounds per message before the app stops asking (a runaway loop guard). */
export const MAX_ROUNDS = 8;

export const SYSTEM_PROMPT = `You are the assistant inside Improvr, a personal app for daily habits, to-dos and a calendar. The person messages you in quick, casual shorthand to get things into the app — "dentist fri 3pm", "gym done", "mum's birthday 12 march", "move the essay to monday" — or to ask what's coming up.

How to help:
- Make the change with your tools straight away, using sensible defaults. Ask a short question only when you really can't tell what's meant (for example two to-dos that both match). Several things in one message means several tool calls.
- Every message from the person starts with an <app_context> block, written by the app: the date and time right now, and what's in the app (to-dos, calendar events, birthdays and today's habits, with their ids). Use it to work out dates like "next friday" or "the 12th", to find the id of anything they want changed, and to answer questions about their plans. It's the app's view, not something the person typed.
- To-do or calendar? If they say which ("add to my to-dos", "put it in the calendar"), do that. Otherwise: things they need to do and tick off (tasks, errands, deadlines, "remember to…") are to-dos; things that happen at a set time or place (appointments, plans, matches, trips, nights out) are calendar events. Birthdays go in birthdays, not the calendar.
- To-dos with no day mentioned go on today. Use "someday" only for things with no real date ("at some point", "one day").
- Logging habits: tick off what they say they've done today ("brushed teeth", "took creatine") with log_habit, using the habit ids from the context. Gym sessions, 15-minute workouts and football are log_workout. Water is a count of bottles: "had another bottle" means one more than today's count. For stay-clean habits, done means they stayed clean and not_done means they slipped — only log those when they tell you. The app's day runs until 4am, so after midnight "tonight" means the date before.
- Never make up ids. Only change or delete things you can see in the context or that you made in this chat.

Replying:
- After making changes, confirm in one short line what you did, with the day and time in words ("Added dentist to your calendar for Friday at 3pm."). The app also shows each change with an Undo button, so don't list every detail.
- For questions, answer briefly from the context.
- Plain text only: no markdown, no headings, no bold. A short list with "-" is fine when it helps.
- Friendly, upbeat and brief, like a mate who's good at admin. British English.`;

const DATE = { type: 'string', format: 'date', description: 'YYYY-MM-DD.' } as const;
const TIME = { type: 'string', description: '24-hour time, HH:mm (e.g. "15:00").' } as const;
const ID = { type: 'string', description: 'The id from the context (or from an earlier tool result).' } as const;

/**
 * Anthropic's limits for strict tools, summed over every strict tool in a request (over them, every
 * request is rejected): https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 */
export const STRICT_LIMITS = { tools: 20, optionalParams: 24, unionParams: 16 };

/**
 * Strict schemas guarantee Claude's arguments match (the app still checks them either way). The
 * "change only what's given" tools have lots of optional fields, so they're left loose to stay
 * inside STRICT_LIMITS — the app's checks tell Claude what to fix if it sends something odd.
 */
const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[], strict = true): Anthropic.Beta.BetaTool => ({
  name,
  description,
  input_schema: { type: 'object', properties, required, additionalProperties: false },
  ...(strict && { strict: true }),
});

export const ASSISTANT_TOOLS: Anthropic.Beta.BetaTool[] = [
  tool(
    'add_todo',
    'Add a to-do: something to do and tick off. Unfinished to-dos carry over to today every day until ticked, so use someday for things with no real date.',
    {
      title: { type: 'string', description: 'Short and clear, without the date or time words, e.g. "Call the bank".' },
      date: { ...DATE, description: 'YYYY-MM-DD. Leave out for today.' },
      someday: { type: 'boolean', description: 'true = no date at all ("someday", "at some point").' },
      time: { ...TIME, description: '24-hour time, HH:mm. Only if they gave one.' },
      list: { type: 'string', description: 'A to-do list id from the context, only if it clearly fits.' },
      important: { type: 'boolean', description: 'Starred: they said it is important or urgent, or used "!".' },
      repeat_days: { type: 'integer', description: 'Comes back this many days after each time it is done (7 = weekly, 14 = fortnightly, 30 = monthly).' },
      notes: { type: 'string' },
    },
    ['title'],
  ),
  tool(
    'update_todo',
    'Change a to-do: tick it off (done: true) or back on (done: false), move it, rename it, star it, or change its time, list or notes. Only send what changes.',
    {
      id: ID,
      done: { type: 'boolean', description: 'true = ticked off today (a repeating one schedules its next one).' },
      title: { type: 'string' },
      date: DATE,
      someday: { type: 'boolean', description: 'true = take the date off.' },
      time: { ...TIME, description: '24-hour time, HH:mm, or "" to remove the time.' },
      list: { type: 'string', description: 'A to-do list id, or "" to take it off its list.' },
      important: { type: 'boolean' },
      notes: { type: 'string', description: 'Replaces the notes ("" to clear).' },
    },
    ['id'],
    false,
  ),
  tool('delete_todo', 'Delete a to-do completely (for mistakes or things no longer needed — use update_todo with done: true when it was done).', { id: ID }, ['id']),
  tool(
    'add_event',
    'Add an event to the calendar: something that happens on a day, usually at a time (appointments, plans, matches, trips).',
    {
      title: { type: 'string', description: 'Short, e.g. "Dentist" or "Drinks with Sam".' },
      date: DATE,
      time: { ...TIME, description: '24-hour start time, HH:mm. Only if they gave one.' },
      notes: { type: 'string', description: 'Anything else worth keeping: where, who, what to bring.' },
      color: { type: 'string', enum: EVENT_COLORS, description: 'Only if they asked for a colour.' },
    },
    ['title', 'date'],
  ),
  tool(
    'update_event',
    'Change a calendar event. Only send what changes.',
    {
      id: ID,
      title: { type: 'string' },
      date: DATE,
      time: { ...TIME, description: '24-hour time, HH:mm, or "" to remove the time.' },
      notes: { type: 'string', description: 'Replaces the notes ("" to clear).' },
      color: { type: 'string', enum: EVENT_COLORS },
    },
    ['id'],
    false,
  ),
  tool('delete_event', 'Delete a calendar event.', { id: ID }, ['id']),
  tool(
    'add_birthday',
    'Save someone’s birthday. It shows every year on the calendar and on Today.',
    {
      name: { type: 'string', description: 'Who, as they said it ("Mum", "Sam").' },
      month: { type: 'integer', description: '1–12.' },
      day: { type: 'integer', description: '1–31.' },
      year: { type: 'integer', description: 'Year they were born, only if they said (so the app can say how old they turn).' },
    },
    ['name', 'month', 'day'],
  ),
  tool('delete_birthday', 'Delete a saved birthday (to fix a wrong one, delete it and add it again).', { id: ID }, ['id']),
  tool(
    'log_habit',
    'Log one of today’s habits from the context: done, not done, or back to unanswered. For water and count habits, amount sets the total so far.',
    {
      habit_id: { type: 'string', description: 'The habit id from the context.' },
      status: { type: 'string', enum: ['done', 'not_done', 'clear'], description: 'done = did it (stay-clean habits: stayed clean). not_done = didn’t (stay-clean: slipped). clear = back to unanswered.' },
      amount: { type: 'integer', description: 'Water and count habits only: the new total for the day (bottles, pages…).' },
      date: { ...DATE, description: 'YYYY-MM-DD. Leave out for today.' },
    },
    ['habit_id', 'status'],
  ),
  tool(
    'log_workout',
    'Log a workout: gym session, 15-minute home workout (Peloton) or football. remove: true takes one back off.',
    {
      type: { type: 'string', enum: ['gym', 'home', 'football'] },
      remove: { type: 'boolean' },
      date: { ...DATE, description: 'YYYY-MM-DD. Leave out for today.' },
    },
    ['type'],
  ),
];
