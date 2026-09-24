import { Button, Card, Center, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { QUOTE } from '../lib/config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'signIn' | 'signUp') {
    setBusy(true);
    setError(null);
    try {
      const cloud = await import('../lib/cloud');
      await cloud[action](email, password);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
          ? 'Wrong email or password.'
          : code.includes('email-already-in-use')
            ? 'That email already has an account — sign in instead.'
            : code.includes('weak-password')
              ? 'Password needs at least 6 characters.'
              : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center mih="100dvh" p="md" className="safe-top">
      <Card w="100%" maw={380} p="xl" className="hero">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run('signIn');
          }}
        >
          <Stack>
            <div>
              <Text fz={40}>🔥</Text>
              <Title order={2}>Improvr</Title>
              <Text c="dimmed" size="sm">
                {QUOTE}
              </Text>
            </div>
            <TextInput label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}
            <Button type="submit" loading={busy} variant="gradient" size="md">
              Sign in
            </Button>
            <Button variant="subtle" size="xs" disabled={busy} onClick={() => void run('signUp')}>
              First time? Create my account
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
