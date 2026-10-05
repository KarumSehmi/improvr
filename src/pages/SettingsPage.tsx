import { Button, Card, FileButton, Group, List, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, TextInput, useMantineColorScheme, type MantineColorScheme } from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconChevronRight, IconDownload, IconUpload } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import HabitsEditor from '../components/HabitsEditor';
import RemindersCard from '../components/RemindersCard';
import SleepSyncCard from '../components/SleepSyncCard';
import { Sheet, Tap } from '../components/ui';
import { accent } from '../lib/style';
import { editHabit } from '../lib/actions';
import { budgetSettings } from '../lib/budget';
import { pop } from '../lib/celebrate';
import { FEATURES, SECTIONS, WEEKDAYS, caffeineCutoff, clockLabel, easyDays, featureOn, sectionHour, weekdayTargets, weekendTargets } from '../lib/config';
import { dateKey } from '../lib/dates';
import { goTo, setHideDone, useSummary, useUi } from '../lib/hooks';
import { getData, importData, updateSettings, useApp } from '../lib/store';
import type { AppData } from '../lib/types';

/** ['Monday', 'Wednesday', 'Friday'] → 'Monday, Wednesday and Friday'. */
const listOf = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));

const HOURS = Array.from({ length: 20 }, (_, i) => i + 4).map((h) => ({ value: String(h), label: `from ${h % 12 || 12}${h < 12 || h === 24 ? 'am' : 'pm'}` }));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="eyebrow group-label">{title}</div>
      <div className="group">{children}</div>
    </div>
  );
}

function Row({ emoji, color, title, sub, right, onClick }: { emoji: string; color: string; title: string; sub: string; right?: ReactNode; onClick: () => void }) {
  return (
    <Tap className="menu-row" onClick={onClick} style={accent(color)} aria-label={title}>
      <span className="menu-icon">{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text fw={700} size="sm">
          {title}
        </Text>
        <Text size="xs" c="dimmed" fw={550} truncate>
          {sub}
        </Text>
      </div>
      {right}
      <IconChevronRight size={17} style={{ opacity: 0.35, flexShrink: 0 }} />
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function TargetsCard() {
  const settings = useApp((s) => s.settings);
  const habits = useSummary().habits;
  const wk = weekdayTargets(settings);
  const we = weekendTargets(settings);
  const water = habits.find((h) => h.kind === 'water');
  const easy = new Set(easyDays(settings));
  const time = (value: string, onChange: (v: string) => void, label: string) => <TimeInput label={label} value={value} onChange={(e) => e.currentTarget.value && onChange(e.currentTarget.value)} />;
  return (
    <Stack gap="lg">
      <div>
        <Text fw={800}>😴 Bed & wake</Text>
        <Text size="xs" c="dimmed" mb="sm">
          What "Asleep before" and "Up before" mean. Weekends are Friday & Saturday nights and Saturday & Sunday mornings. Your Apple Watch and the reminders follow these.
        </Text>
        <SimpleGrid cols={2} spacing="sm">
          {time(wk.sleep, (v) => updateSettings({ weekday: { ...settings.weekday, sleep: v } }), 'Weekdays: asleep by')}
          {time(wk.wake, (v) => updateSettings({ weekday: { ...settings.weekday, wake: v } }), 'Weekdays: up by')}
          {time(we.sleep, (v) => updateSettings({ weekend: { ...settings.weekend, sleep: v } }), 'Weekends: asleep by')}
          {time(we.wake, (v) => updateSettings({ weekend: { ...settings.weekend, wake: v } }), 'Weekends: up by')}
        </SimpleGrid>
      </div>
      <SimpleGrid cols={2} spacing="sm">
        <TimeInput label="☕ No caffeine after" value={caffeineCutoff(settings)} onChange={(e) => e.currentTarget.value && updateSettings({ caffeineCutoff: e.currentTarget.value })} />
        {water && <NumberInput label="🚰 Bottles of water" min={1} max={8} value={water.target ?? 3} onChange={(v) => Number(v) >= 1 && editHabit('water', { target: Number(v) })} />}
        <NumberInput
          label="🏋️ Gym sessions / week"
          description="0 hides Training"
          min={0}
          max={7}
          value={settings.workoutTarget}
          onChange={(v) => Number(v) >= 0 && v !== '' && updateSettings({ workoutTarget: Number(v) })}
        />
      </SimpleGrid>
      <div>
        <Text fw={800}>🛋️ Easy days</Text>
        <Text size="xs" c="dimmed" mb="sm">
          {easy.size ? `${listOf([...easy].sort().map((d) => WEEKDAYS[d]))} stay light: ` : 'Pick days to keep light (e.g. football Monday): '}
          room jobs that repeat every few days, like the bin, wait for the next normal day. Daily tidy-ups still show, and anything late still carries over.
        </Text>
        <Group gap={6} wrap="nowrap">
          {WEEKDAYS.map((d, i) => {
            const on = easy.has(i);
            return (
              <Tap
                key={d}
                className="chip"
                data-active={on || undefined}
                aria-label={`${d}: ${on ? 'easy day' : 'normal'}`}
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(easy);
                  if (on) next.delete(i);
                  else next.add(i);
                  updateSettings({ easyDays: [...next].sort() });
                }}
                style={{ width: 38, padding: 0, justifyContent: 'center' }}
              >
                {d[0]}
              </Tap>
            );
          })}
        </Group>
      </div>
      <div>
        <Text fw={800}>🕒 When each part of Today comes due</Text>
        <Text size="xs" c="dimmed" mb="sm">
          Before then it's folded away as "later" and isn't on the app icon's count.
        </Text>
        <SimpleGrid cols={2} spacing="sm">
          {SECTIONS.map((s) => (
            <Select
              key={s.id}
              label={`${s.emoji} ${s.short}`}
              data={HOURS}
              value={String(sectionHour(settings, s.id))}
              onChange={(v) => v && updateSettings({ sectionHours: { ...settings.sectionHours, [s.id]: Number(v) } })}
              allowDeselect={false}
            />
          ))}
        </SimpleGrid>
      </div>
    </Stack>
  );
}

function FeaturesCard() {
  const settings = useApp((s) => s.settings);
  const hideDone = useUi((s) => s.hideDone);
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Keep Today as busy or as simple as you like. Switching something off hides it — nothing you've logged is lost.
      </Text>
      {FEATURES.map((f) => (
        <Switch
          key={f.id}
          color="teal"
          size="md"
          checked={featureOn(settings, f.id)}
          onChange={(e) => updateSettings({ features: { ...settings.features, [f.id]: e.currentTarget.checked } })}
          label={`${f.emoji} ${f.label}`}
          description={f.detail}
        />
      ))}
      <Switch color="teal" size="md" checked={hideDone} onChange={(e) => setHideDone(e.currentTarget.checked)} label="👁️ Hide ticked-off things" description="Keeps Today short as the day goes on (this device only)" />
    </Stack>
  );
}

function FinesSettings() {
  const settings = useApp((s) => s.settings);
  const owed = useSummary().owed;
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Lock each day in by midnight the next day, or it's a fine to charity. That's the only punishment.
      </Text>
      <NumberInput label="Fine per day not locked in" prefix="£" min={1} value={settings.fineAmount} onChange={(v) => Number(v) > 0 && updateSettings({ fineAmount: Number(v) })} />
      <TextInput label="Charity" defaultValue={settings.charity} onBlur={(e) => updateSettings({ charity: e.currentTarget.value.trim() || 'a charity of your choice' })} />
      <TextInput label="Donation link" description="Makes paying a fine one tap" placeholder="https://…" defaultValue={settings.donateUrl ?? ''} onBlur={(e) => updateSettings({ donateUrl: e.currentTarget.value.trim() || undefined })} />
      <Button variant={owed ? 'filled' : 'light'} color={owed ? 'red' : 'violet'} onClick={() => goTo('progress', { progressTab: 'money' })}>
        {owed ? `Pay the £${owed} you owe` : 'See fines and payments'}
      </Button>
    </Stack>
  );
}

function CardSettings() {
  const settings = useApp((s) => s.settings);
  const b = budgetSettings(settings);
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Once a week, type in what you've spent on your credit card so far this month (+10 XP). It shows you against your limit and pace.
      </Text>
      <NumberInput label="Monthly limit" prefix="£" min={50} step={50} thousandSeparator="," value={b.limit} onChange={(v) => Number(v) > 0 && updateSettings({ budget: { ...settings.budget, limit: Number(v) } })} />
      <NumberInput
        label="Hard ceiling"
        description="The amount to stay well clear of"
        prefix="£"
        min={50}
        step={50}
        thousandSeparator=","
        value={b.ceiling}
        onChange={(v) => Number(v) > 0 && updateSettings({ budget: { ...settings.budget, ceiling: Number(v) } })}
      />
      <NumberInput
        label="Card month starts on"
        description="Day of the month (1–28)"
        min={1}
        max={28}
        value={b.startDay}
        onChange={(v) => Number(v) >= 1 && updateSettings({ budget: { ...settings.budget, startDay: Math.min(28, Number(v)) } })}
      />
      <Switch
        color="teal"
        checked={featureOn(settings, 'budget')}
        onChange={(e) => updateSettings({ features: { ...settings.features, budget: e.currentTarget.checked } })}
        label="Track card spending"
        description="Off hides the weekly reminder and the Money card"
      />
    </Stack>
  );
}

function RulesCard() {
  const settings = useApp((s) => s.settings);
  const fine = `£${settings.fineAmount}`;
  const wk = weekdayTargets(settings);
  const we = weekendTargets(settings);
  return (
    <List spacing="sm" size="sm">
      <List.Item>
        <b>Log every day.</b> Tick things off as you go, then <i>Lock in</i>. You have until midnight at the end of the next day. Miss it and it's <b>{fine} to charity</b>. That's
        the only punishment.
      </List.Item>
      <List.Item>
        <b>One day off per week</b> (Mon–Sun). Streaks freeze, nothing counts against you and it counts as logged. Slips you log still count.
      </List.Item>
      <List.Item>
        <b>Tick everything → the day locks itself</b> and you get a perfect-day bonus. Locking in on time opens a <b>reward chest</b> (a perfect day's is golden).
      </List.Item>
      <List.Item>
        <b>Check in three times a day</b> for XP, with a bonus for all three. Plus one optional <b>bonus quest</b> a day.
      </List.Item>
      <List.Item>
        <b>Jobs carry over.</b> If you don't do it, it's back tomorrow (in orange) until you do — or skip one from its sheet.
      </List.Item>
      {settings.workoutTarget > 0 && (
        <List.Item>
          <b>Gym is weekly:</b> {settings.workoutTarget}+ sessions Mon–Sun. The 15 min workout and football earn XP but don't count towards the target.
        </List.Item>
      )}
      <List.Item>
        <b>Bed & wake:</b> asleep by {clockLabel(wk.sleep)} and up by {clockLabel(wk.wake)} on weekdays; {clockLabel(we.sleep)} and {clockLabel(we.wake)} at the weekend.
      </List.Item>
      <List.Item>
        <b>Bonus habits</b> earn XP but never count against you. <b>Stayed clean</b> must be answered honestly before you lock in — slips never cost money, they just reset the
        streak.
      </List.Item>
    </List>
  );
}

function ProfileCard() {
  const settings = useApp((s) => s.settings);
  return (
    <Stack gap="md">
      <TextInput label="Your name" defaultValue={settings.name} onBlur={(e) => updateSettings({ name: e.currentTarget.value.trim() })} />
      <DatePickerInput
        label="Tracking start date"
        description="Nothing before this date counts (no fines, no streaks)"
        value={settings.startDate}
        maxDate={dateKey()}
        onChange={(d) => d && updateSettings({ startDate: d })}
      />
    </Stack>
  );
}

function AppearanceCard() {
  const settings = useApp((s) => s.settings);
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <Stack gap="lg">
      <div>
        <Text size="sm" fw={600} mb={6}>
          Theme
        </Text>
        <SegmentedControl
          fullWidth
          value={colorScheme}
          onChange={(v) => setColorScheme(v as MantineColorScheme)}
          data={[
            { value: 'dark', label: '🌙 Dark' },
            { value: 'light', label: '☀️ Light' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
      </div>
      <Switch
        color="teal"
        size="md"
        label="Sounds"
        description="A little pop when you tick things off. Your iPhone's silent switch mutes them."
        checked={settings.sounds !== false}
        onChange={(e) => {
          const on = e.currentTarget.checked;
          updateSettings({ sounds: on });
          if (on) pop();
        }}
      />
    </Stack>
  );
}

function AccountCard() {
  const mode = useApp((s) => s.mode);
  const email = useApp((s) => s.email);
  const syncError = useApp((s) => s.syncError);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `improvr-backup-${dateKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File | null) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Partial<AppData>;
      modals.openConfirmModal({
        title: 'Import this backup?',
        children: (
          <Text size="sm">
            {Object.keys(data.days ?? {}).length} days, {Object.keys(data.todos ?? {}).length} to-dos, {Object.keys(data.events ?? {}).length} events and{' '}
            {Object.keys(data.birthdays ?? {}).length} birthdays will be merged into your current data.
          </Text>
        ),
        labels: { confirm: 'Import', cancel: 'Cancel' },
        onConfirm: () => {
          importData(data);
          notifications.show({ color: 'teal', title: 'Imported', message: 'Backup merged in.' });
        },
      });
    } catch {
      notifications.show({ color: 'red', title: "Couldn't read that file", message: 'Is it an Improvr backup?' });
    }
  };

  return (
    <Stack gap="md">
      {mode === 'cloud' ? (
        <Text size="sm">
          Syncing across your devices as <b>{email}</b>.
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          Local mode — data is saved on this device only. Add your Firebase config (see README) to sync your phone and computer.
        </Text>
      )}
      {syncError && (
        <Text size="xs" c="red">
          Sync error: {syncError}
        </Text>
      )}
      <Group grow>
        <Button variant="default" leftSection={<IconDownload size={16} />} onClick={exportJson}>
          Export backup
        </Button>
        <FileButton onChange={(f) => void importJson(f)} accept="application/json">
          {(props) => (
            <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
              Import backup
            </Button>
          )}
        </FileButton>
      </Group>
      {mode === 'cloud' && (
        <Button variant="subtle" color="red" onClick={() => void import('../lib/cloud').then((m) => m.signOut())}>
          Sign out
        </Button>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------

/** Everything else, as a grouped list. Each opens in a sheet. */
export default function SettingsPage() {
  const summary = useSummary();
  const sheet = useUi((s) => s.settingsSheet);
  const settings = useApp((s) => s.settings);
  const mode = useApp((s) => s.mode);
  const email = useApp((s) => s.email);
  const lastSleep = useApp((s) => s.server?.lastSleep);
  const devices = useApp((s) => s.pushDevices);
  const open = (id: string) => useUi.setState({ settingsSheet: id });
  const wk = weekdayTargets(settings);
  const off = FEATURES.filter((f) => !featureOn(settings, f.id)).length;
  const b = budgetSettings(settings);

  const sheets: Record<string, { title?: string; body: ReactNode }> = {
    habits: { title: 'Your habits', body: <HabitsEditor /> },
    targets: { title: 'Targets & times', body: <TargetsCard /> },
    features: { title: 'Today page', body: <FeaturesCard /> },
    fines: { title: 'Charity fines', body: <FinesSettings /> },
    rules: { title: 'The rules', body: <RulesCard /> },
    card: { title: 'Card spending', body: <CardSettings /> },
    notifications: { body: <RemindersCard /> },
    watch: { body: <SleepSyncCard /> },
    sync: { title: 'Sync & backup', body: <AccountCard /> },
    profile: { title: 'You', body: <ProfileCard /> },
    appearance: { title: 'Look & sound', body: <AppearanceCard /> },
  };
  const current = sheet ? sheets[sheet] : undefined;

  return (
    <Stack gap={18}>
      <div>
        <div className="eyebrow">{mode === 'cloud' ? `Synced · ${email}` : 'This device only'}</div>
        <Text component="h1" className="page-title" mt={4}>
          Settings
        </Text>
      </div>

      <Section title="Your routine">
        <Row emoji="✏️" color="violet" title="Habits" sub={`${summary.habits.length} tracked · edit, reorder, add your own`} onClick={() => open('habits')} />
        <Row emoji="🎯" color="orange" title="Targets & times" sub={`Bed ${clockLabel(wk.sleep)} · up ${clockLabel(wk.wake)} · caffeine ${clockLabel(caffeineCutoff(settings))} · gym ${settings.workoutTarget}×`} onClick={() => open('targets')} />
        <Row emoji="📱" color="cyan" title="Today page" sub={off ? `${off} switched off` : 'Check-ins, quest, chest, race, SOS, card'} onClick={() => open('features')} />
      </Section>

      <Section title="Accountability">
        <Row
          emoji="💷"
          color="red"
          title="Charity fines"
          sub={summary.owed ? `£${summary.owed} owed · £${settings.fineAmount} a missed day` : `£${settings.fineAmount} a missed day · ${settings.charity}`}
          onClick={() => open('fines')}
        />
        <Row emoji="📜" color="yellow" title="The rules" sub="How it all works" onClick={() => open('rules')} />
      </Section>

      <Section title="Money">
        <Row emoji="💳" color="teal" title="Card spending" sub={featureOn(settings, 'budget') ? `£${b.limit.toLocaleString('en-GB')} a month · starts on the ${b.startDay}${b.startDay === 1 ? 'st' : 'th'}` : 'Off'} onClick={() => open('card')} />
      </Section>

      <Section title="Connected">
        <Row emoji="🔔" color="grape" title="Notifications" sub={mode === 'cloud' && devices ? `On · ${devices} device${devices === 1 ? '' : 's'}` : 'What you get reminded about, and how often'} onClick={() => open('notifications')} />
        <Row emoji="⌚" color="indigo" title="Apple Watch sleep" sub={lastSleep ? `Last synced ${dayjs(lastSleep.at).format('ddd HH:mm')}` : 'Fill in sleep automatically'} onClick={() => open('watch')} />
        <Row emoji="☁️" color="blue" title="Sync & backup" sub={mode === 'cloud' ? `Signed in as ${email}` : 'This device only'} onClick={() => open('sync')} />
      </Section>

      <Section title="You">
        <Row emoji="👤" color="pink" title="Name & start date" sub={settings.name || 'Add your name'} onClick={() => open('profile')} />
        <Row emoji="🎨" color="violet" title="Look & sound" sub="Theme, sounds" onClick={() => open('appearance')} />
      </Section>

      <Card p="md" ta="center" style={{ background: 'transparent', border: 0, boxShadow: 'none' }}>
        <Text fz={26}>🔥</Text>
        <Text size="xs" c="dimmed" fw={600}>
          Improvr · just try to be better than you were yesterday
        </Text>
      </Card>

      <Sheet opened={!!current} onClose={() => useUi.setState({ settingsSheet: null })} title={current?.title}>
        {current?.body}
      </Sheet>
    </Stack>
  );
}
