import { Center, Loader } from '@mantine/core';
import { lazy, Suspense, useState } from 'react';
import { useUi } from '../lib/hooks';
import { Sheet } from './ui';

// Charts are big, so a habit's stats load the first time you open one.
const HabitStats = lazy(() => import('./HabitStats'));

/** A habit's full stats, from anywhere (tap a habit on Progress, or "Full stats" in its sheet). */
export default function StatsSheet() {
  const id = useUi((s) => s.statsHabit);
  // Keep showing the habit while the sheet slides away.
  const [shown, setShown] = useState(id);
  if (id && id !== shown) setShown(id);
  const close = () => useUi.setState({ statsHabit: null });
  return (
    <Sheet opened={!!id} onClose={close} size="lg" zIndex={305}>
      {shown && (
        <Suspense
          fallback={
            <Center py={80}>
              <Loader type="dots" color="violet" />
            </Center>
          }
        >
          <HabitStats key={shown} id={shown} />
        </Suspense>
      )}
    </Sheet>
  );
}
