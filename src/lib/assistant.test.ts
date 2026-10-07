import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSISTANT_TOOLS, MAX_CHAT_CHARS, MAX_MESSAGES, MAX_ROUNDS } from './assistant';
import { buildContext, runTool } from './assistantTools';
import { chatFull, chatItems, newChat, sendMessage, undoChange, useChat } from './chat';
import { defaultSettings } from './config';
import { emptyData, useApp } from './store';
import type { Todo } from './types';

vi.mock('./cloud', () => ({ idToken: async () => 'token' }));

const TODAY = '2026-10-07'; // a Wednesday
const NOW = new Date(2026, 9, 7, 14, 30);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useApp.setState({ ...emptyData(), settings: { ...defaultSettings('2026-09-21'), name: 'Karum' }, status: 'ready', mode: 'local' });
  newChat();
});

const state = () => useApp.getState();
const todo = (t: Partial<Todo> & { id: string; title: string }): Todo => ({ date: TODAY, doneOn: null, createdAt: 1, ...t });

describe('tool definitions', () => {
  it('only use schema features strict tools accept, and name every required field', () => {
    const names = ASSISTANT_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of ASSISTANT_TOOLS) {
      expect(t.strict).toBe(true);
      expect(t.input_schema.additionalProperties).toBe(false);
      const props = t.input_schema.properties as Record<string, object>;
      for (const r of t.input_schema.required ?? []) expect(props).toHaveProperty(r);
      expect(JSON.stringify(t.input_schema)).not.toMatch(/"(minimum|maximum|minLength|maxLength|pattern|multipleOf)"/);
    }
  });
});

describe('what Claude sees', () => {
  it('has the time, lists, to-dos with ids, events, birthdays and today’s habits', () => {
    useApp.setState({
      todos: { t1: todo({ id: 't1', title: 'Call bank', date: '2026-10-05', time: '15:00', important: true }), t2: todo({ id: 't2', title: 'Buy a kettle', date: null }) },
      events: { e1: { id: 'e1', title: 'Dentist', date: '2026-10-09', time: '15:00', createdAt: 1 }, old: { id: 'old', title: 'Ancient', date: '2025-01-01', createdAt: 1 } },
      birthdays: { b1: { id: 'b1', name: 'Mum', month: 3, day: 12, year: 1970 } },
      days: { [TODAY]: { water: 1, workouts: ['gym'], done: { creatine: true } } },
    });
    const ctx = buildContext({ ...state() }, NOW);
    expect(ctx).toContain('Wednesday 7 October 2026, 14:30');
    expect(ctx).toContain('Today is 2026-10-07');
    expect(ctx).toContain('Their name: Karum');
    expect(ctx).toContain('work: 💼 Work & uni');
    expect(ctx).toMatch(/t1: "Call bank" · 2026-10-05 \(Mon 5 Oct\) — overdue.* · 15:00 · ★ starred/);
    expect(ctx).toContain('t2: "Buy a kettle" · someday');
    expect(ctx).toContain('e1: "Dentist" · 2026-10-09 (Fri 9 Oct) · 15:00');
    expect(ctx).not.toContain('Ancient');
    expect(ctx).toMatch(/b1: Mum · 12 March \(next 2027-03-12 .*turning 57\)/);
    expect(ctx).toContain('water: 🚰 3 bottles of water — water — 1/3 bottles');
    expect(ctx).toContain('creatine: 🥄 Took creatine — check — done');
    expect(ctx).toContain('Workouts today: gym');
  });
});

describe('running tools', () => {
  it('adds a to-do on today by default, with time, list, star and repeat — and Undo removes it', () => {
    const out = runTool('add_todo', { title: 'Haircut', time: '9:30', list: 'home', important: true, repeat_days: 14 }, NOW);
    expect(out.isError).toBeUndefined();
    const t = Object.values(state().todos)[0];
    expect(t).toMatchObject({ title: 'Haircut', date: TODAY, time: '09:30', list: 'home', important: true, repeat: 14 });
    expect(out.result).toContain(t.id);
    expect(out.change!.label).toBe('📝 Haircut · Today 9:30am');
    out.change!.undo();
    expect(state().todos).toEqual({});
  });

  it('adds someday to-dos and finds lists by name', () => {
    runTool('add_todo', { title: 'New headphones', someday: true, list: 'Shopping' }, NOW);
    expect(Object.values(state().todos)[0]).toMatchObject({ date: null, list: 'shop' });
  });

  it('tells Claude what was wrong instead of guessing', () => {
    expect(runTool('add_todo', { title: '  ' }, NOW)).toMatchObject({ isError: true, result: '"title" can\'t be empty.' });
    expect(runTool('add_todo', { title: 'x', date: '2026-02-30' }, NOW).isError).toBe(true);
    expect(runTool('add_todo', { title: 'x', time: '25:00' }, NOW).isError).toBe(true);
    expect(runTool('add_todo', { title: 'x', list: 'nope' }, NOW).result).toMatch(/Use one of: work, admin/);
    expect(runTool('update_todo', { id: 'missing', done: true }, NOW).result).toBe('No to-do with id "missing". Use an id from the context.');
    expect(runTool('make_coffee', {}, NOW).isError).toBe(true);
    expect(state().todos).toEqual({});
  });

  it('ticks off a repeating to-do (scheduling the next) and Undo takes both back', () => {
    useApp.setState({ todos: { t1: todo({ id: 't1', title: 'Haircut', repeat: 14 }) } });
    const out = runTool('update_todo', { id: 't1', done: true }, NOW);
    const after = state().todos.t1;
    expect(after.doneOn).toBe(TODAY);
    expect(state().todos[after.next!]).toMatchObject({ title: 'Haircut', date: '2026-10-21' });
    expect(out.change!.label).toBe('✅ Ticked off: Haircut');
    out.change!.undo();
    expect(state().todos).toEqual({ t1: todo({ id: 't1', title: 'Haircut', repeat: 14 }) });
  });

  it('moves, renames and clears a to-do’s time and list', () => {
    useApp.setState({ todos: { t1: todo({ id: 't1', title: 'Essay', time: '10:00', list: 'work' }) } });
    runTool('update_todo', { id: 't1', title: 'Essay draft', date: '2026-10-12', time: '', list: '' }, NOW);
    expect(state().todos.t1).toMatchObject({ title: 'Essay draft', date: '2026-10-12', time: null, list: null });
  });

  it('deletes a to-do, with Undo', () => {
    const t = todo({ id: 't1', title: 'Oops' });
    useApp.setState({ todos: { t1: t } });
    const out = runTool('delete_todo', { id: 't1' }, NOW);
    expect(state().todos).toEqual({});
    out.change!.undo();
    expect(state().todos.t1).toEqual(t);
  });

  it('adds, changes and deletes calendar events', () => {
    const added = runTool('add_event', { title: 'Dentist', date: '2026-10-09', time: '15:00', notes: 'Bring forms' }, NOW);
    const e = Object.values(state().events)[0];
    expect(e).toMatchObject({ title: 'Dentist', date: '2026-10-09', time: '15:00', notes: 'Bring forms', color: 'violet' });
    expect(added.change!.label).toBe('📅 Dentist · Friday 3pm');

    const moved = runTool('update_event', { id: e.id, date: '2026-10-10', time: '', color: 'teal' }, NOW);
    expect(state().events[e.id]).toMatchObject({ date: '2026-10-10', time: undefined, color: 'teal' });
    moved.change!.undo();
    expect(state().events[e.id]).toEqual(e);

    expect(runTool('add_event', { title: 'No day' }, NOW).isError).toBe(true);
    expect(runTool('update_event', { id: e.id, color: 'neon' }, NOW).isError).toBe(true);
    runTool('delete_event', { id: e.id }, NOW);
    expect(state().events).toEqual({});
  });

  it('saves birthdays (29 Feb is fine, 31 Feb isn’t)', () => {
    const out = runTool('add_birthday', { name: 'Mum', month: 3, day: 12, year: 1970 }, NOW);
    expect(Object.values(state().birthdays)[0]).toMatchObject({ name: 'Mum', month: 3, day: 12, year: 1970 });
    expect(out.change!.label).toBe('🎂 Mum · 12 March');
    expect(runTool('add_birthday', { name: 'Leap', month: 2, day: 29 }, NOW).isError).toBeUndefined();
    expect(runTool('add_birthday', { name: 'Nope', month: 2, day: 31 }, NOW).isError).toBe(true);
    expect(runTool('add_birthday', { name: 'Nope', month: 13, day: 1 }, NOW).isError).toBe(true);
  });

  it('logs habits: done, not done, water totals and clear — and Undo only touches that habit', () => {
    runTool('log_habit', { habit_id: 'protein', status: 'done' }, NOW);
    const creatine = runTool('log_habit', { habit_id: 'creatine', status: 'done' }, NOW);
    expect(state().days[TODAY].done).toMatchObject({ protein: true, creatine: true });
    expect(creatine.change!.label).toBe('✅ Took creatine: done');

    creatine.change!.undo();
    expect(state().days[TODAY].done).toEqual({ protein: true });
    expect(state().days[TODAY].doneAt).toHaveProperty('protein');
    expect(state().days[TODAY].doneAt).not.toHaveProperty('creatine');

    const water = runTool('log_habit', { habit_id: 'water', status: 'done', amount: 2 }, NOW);
    expect(state().days[TODAY].water).toBe(2);
    expect(water.result).toContain('2/3 bottles');

    runTool('log_habit', { habit_id: 'macro', status: 'not_done' }, NOW);
    expect(state().days[TODAY].missed).toEqual({ macro: true });
    runTool('log_habit', { habit_id: 'macro', status: 'clear' }, NOW);
    expect(state().days[TODAY].missed).toEqual({});

    expect(runTool('log_habit', { habit_id: 'nope', status: 'done' }, NOW).isError).toBe(true);
    expect(runTool('log_habit', { habit_id: 'protein', status: 'done', date: '2026-10-08' }, NOW).isError).toBe(true);
  });

  it('answers stay-clean habits honestly', () => {
    const slip = runTool('log_habit', { habit_id: 'vape', status: 'not_done' }, NOW);
    expect(state().days[TODAY].avoid).toEqual({ vape: 'slip' });
    expect(slip.change!.label).toBe('✖️ No nicotine: slipped');
    runTool('log_habit', { habit_id: 'vape', status: 'done' }, NOW);
    expect(state().days[TODAY].avoid).toEqual({ vape: 'clean' });
  });

  it('logs and removes workouts, with Undo', () => {
    const out = runTool('log_workout', { type: 'gym' }, NOW);
    runTool('log_workout', { type: 'gym' }, NOW); // twice is still one session
    expect(state().days[TODAY].workouts).toEqual(['gym']);
    out.change!.undo();
    expect(state().days[TODAY].workouts).toEqual([]);
    expect(runTool('log_workout', { type: 'swim' }, NOW).isError).toBe(true);
  });
});

describe('the chat', () => {
  type Reply = { content: object[]; stop_reason: string };
  function server(replies: Reply[]) {
    const bodies: { messages: { role: string; content: unknown }[] }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        const reply = replies.shift();
        return { ok: !!reply, status: reply ? 200 : 500, json: async () => reply ?? { error: 'Boom' } };
      }),
    );
    return bodies;
  }

  it('runs Claude’s tools, sends back the results and shows the changes (never editing what was sent)', async () => {
    useApp.setState({ mode: 'cloud' });
    const bodies = server([
      {
        content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          { type: 'tool_use', id: 'call1', name: 'add_event', input: { title: 'Dentist', date: '2026-10-09', time: '15:00' } },
          { type: 'tool_use', id: 'call2', name: 'log_workout', input: { type: 'gym' } },
        ],
        stop_reason: 'tool_use',
      },
      { content: [{ type: 'text', text: 'Added the dentist for Friday at 3pm and logged the gym.' }], stop_reason: 'end_turn' },
    ]);

    await sendMessage('dentist fri 3pm, gym done');

    expect(bodies).toHaveLength(2);
    const [first, second] = bodies;
    expect(first.messages).toHaveLength(1);
    // Append-only: the second request starts with exactly the first one's messages.
    expect(second.messages.slice(0, 1)).toEqual(first.messages);
    expect(second.messages[1]).toMatchObject({ role: 'assistant', content: [{ type: 'thinking', signature: 'sig' }, { id: 'call1' }, { id: 'call2' }] });
    expect(second.messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'call1', content: expect.stringContaining('Added event') },
        { type: 'tool_result', tool_use_id: 'call2', content: 'Gym logged for 2026-10-07.' },
      ],
    });
    expect(Object.values(state().events)[0]).toMatchObject({ title: 'Dentist', date: '2026-10-09' });
    expect(state().days[TODAY].workouts).toEqual(['gym']);

    const { messages, changes, busy, error } = useChat.getState();
    expect(busy).toBe(false);
    expect(error).toBeNull();
    expect(chatItems(messages, changes).map((i) => (i.kind === 'change' ? i.label : `${i.kind}: ${i.text}`))).toEqual([
      'you: dentist fri 3pm, gym done',
      '📅 Dentist · Friday 3pm',
      '🏋️ Gym logged',
      'claude: Added the dentist for Friday at 3pm and logged the gym.',
    ]);

    undoChange('call2');
    expect(state().days[TODAY].workouts).toEqual([]);
    expect(chatItems(useChat.getState().messages, useChat.getState().changes)[2]).toMatchObject({ kind: 'change', undone: true });
  });

  it('answers every tool call even when the reply was cut off, and shows server errors', async () => {
    useApp.setState({ mode: 'cloud' });
    server([{ content: [{ type: 'tool_use', id: 'c1', name: 'add_todo', input: { title: 'Half' } }], stop_reason: 'max_tokens' }]);
    await sendMessage('lots of things');
    const { messages, error } = useChat.getState();
    expect(messages.at(-1)).toEqual({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'Not done: the reply was cut off.', is_error: true }] });
    expect(state().todos).toEqual({});
    expect(error).toMatch(/cut off/);

    newChat();
    server([]);
    await sendMessage('hello');
    expect(useChat.getState().error).toBe('Boom');
  });

  it('stops after too many tool rounds', async () => {
    useApp.setState({ mode: 'cloud' });
    const loop = { content: [{ type: 'tool_use', id: 'x', name: 'log_workout', input: { type: 'gym' } }], stop_reason: 'tool_use' };
    const bodies = server(Array.from({ length: MAX_ROUNDS + 2 }, () => structuredClone(loop)));
    await sendMessage('go');
    expect(bodies).toHaveLength(MAX_ROUNDS);
    expect(useChat.getState().error).toMatch(/too many steps/);
  });

  it('asks for a new chat before it gets too long for the server', () => {
    const big = { role: 'user' as const, content: 'x'.repeat(MAX_CHAT_CHARS * 0.8) };
    expect(chatFull([])).toBe(false);
    expect(chatFull([big])).toBe(true);
    expect(chatFull(Array.from({ length: MAX_MESSAGES - 2 * MAX_ROUNDS }, () => ({ role: 'user' as const, content: 'hi' })))).toBe(true);
  });

  it('needs sync (the server checks who you are)', async () => {
    const bodies = server([]);
    await sendMessage('hi');
    expect(bodies).toHaveLength(0);
    expect(useChat.getState().error).toMatch(/needs sync/);
  });
});
