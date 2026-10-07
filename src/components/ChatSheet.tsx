/**
 * Ask Improvr: tell it what to add or log in your own words ("dentist fri 3pm", "gym done and 2
 * bottles of water", "mum's birthday 12 march") and it does it, showing each change with an Undo.
 */
import { ActionIcon, Button, Group, Loader, Text, Textarea, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowBackUp, IconArrowUp, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { chatFull, chatItems, newChat, retry, sendMessage, undoChange, useChat } from '../lib/chat';
import { useUi } from '../lib/hooks';
import { useApp } from '../lib/store';
import { Sheet } from './ui';

const EXAMPLES = ['Dentist Friday at 3pm', 'Remind me to call the bank tomorrow', 'Gym done and 2 bottles of water', 'Mum’s birthday is 12 March', 'What’s on this week?'];

export default function ChatSheet() {
  const opened = useUi((s) => s.chatOpen);
  const close = () => useUi.setState({ chatOpen: false });
  return (
    <Sheet opened={opened} onClose={close} size="lg" title="💬 Ask Improvr">
      {opened && <Body />}
    </Sheet>
  );
}

function Body() {
  const messages = useChat((s) => s.messages);
  const changes = useChat((s) => s.changes);
  const busy = useChat((s) => s.busy);
  const error = useChat((s) => s.error);
  const cloud = useApp((s) => s.mode === 'cloud');
  const wide = useMediaQuery('(min-width: 48em)');
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const items = chatItems(messages, changes);
  const full = chatFull(messages);
  const canRetry = !busy && !!error && messages.at(-1)?.role === 'user';

  // Keep the newest message in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [items.length, busy, error]);

  const send = (t: string) => {
    if (!t.trim() || busy || full || !cloud) return;
    setText('');
    void sendMessage(t);
  };

  return (
    <div className="chat">
      <div className="chat-list" ref={list}>
        {items.length === 0 ? (
          <div className="chat-empty">
            <Text fz={36} lh={1}>
              ✨
            </Text>
            <Text fw={800} fz={17}>
              Tell me what to add or log
            </Text>
            <Text size="sm" c="dimmed" maw={320}>
              To-dos, calendar events, birthdays and today’s habits — just say it how you’d text it.
            </Text>
            {cloud ? (
              <div className="chat-examples">
                {EXAMPLES.map((ex) => (
                  <UnstyledButton key={ex} className="chip" data-small onClick={() => send(ex)}>
                    {ex}
                  </UnstyledButton>
                ))}
              </div>
            ) : (
              <Text size="sm" c="orange" maw={320}>
                The assistant needs sync turned on (Settings → Sync & backup), so the server knows it’s you.
              </Text>
            )}
          </div>
        ) : (
          <Group justify="flex-end">
            <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconPlus size={13} />} onClick={newChat} disabled={busy}>
              New chat
            </Button>
          </Group>
        )}

        {items.map((item) =>
          item.kind === 'change' ? (
            <div key={item.key} className="chat-change" data-undone={item.undone || undefined}>
              <span>{item.label}</span>
              {item.undone ? (
                <Text size="xs" c="dimmed" fw={700} pr={6}>
                  undone
                </Text>
              ) : (
                <Button size="compact-xs" variant="light" color="gray" leftSection={<IconArrowBackUp size={13} />} onClick={() => undoChange(item.id)}>
                  Undo
                </Button>
              )}
            </div>
          ) : (
            <div key={item.key} className="chat-msg" data-from={item.kind}>
              {item.text}
            </div>
          ),
        )}

        {busy && (
          <div className="chat-msg" data-from="claude" aria-label="Thinking">
            <Loader type="dots" size="sm" color="violet" />
          </div>
        )}
        {error && (
          <Group gap={8} wrap="nowrap" className="chat-error">
            <Text size="sm" c="red" style={{ flex: 1 }}>
              {error}
            </Text>
            {canRetry && (
              <Button size="compact-sm" variant="light" color="red" leftSection={<IconRefresh size={14} />} onClick={retry}>
                Retry
              </Button>
            )}
          </Group>
        )}
        {full && (
          <Text size="sm" c="dimmed" ta="center">
            This chat’s getting long — tap New chat to keep going.
          </Text>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter for a new line.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder={busy ? 'Working on it…' : 'e.g. “essay due monday !” or “took creatine”'}
          aria-label="Message the assistant"
          enterKeyHint="send"
          autosize
          minRows={1}
          maxRows={5}
          radius="xl"
          size="md"
          autoFocus={wide}
          disabled={!cloud || full}
          rightSectionWidth={44}
          rightSection={
            <ActionIcon type="submit" variant={text.trim() && !busy ? 'gradient' : 'subtle'} color="gray" disabled={!text.trim() || busy} aria-label="Send">
              <IconArrowUp size={17} stroke={2.6} />
            </ActionIcon>
          }
        />
      </form>
    </div>
  );
}

/** A button that looks like a message box, to open the chat from the + sheet. */
export function ChatLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <UnstyledButton className="chat-launcher" onClick={onOpen} aria-label="Ask Improvr">
      <span aria-hidden>💬</span>
      <span style={{ flex: 1 }}>Ask Improvr… “dentist fri 3pm, gym done”</span>
    </UnstyledButton>
  );
}
