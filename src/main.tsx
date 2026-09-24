import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import 'dayjs/locale/en-gb';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { cloudEnabled } from './firebaseConfig';
import { startLocal } from './lib/store';
import BuddyPage from './pages/BuddyPage';
import { theme } from './theme';

dayjs.locale('en-gb');
registerSW({ immediate: true });

// A buddy opening your shared link sees a read-only page — no login, none of your app.
const buddyToken = new URLSearchParams(window.location.search).get('buddy');

if (buddyToken) {
  // nothing to start
} else if (cloudEnabled) {
  void import('./lib/cloud').then((m) => m.startCloud());
} else {
  startLocal();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <DatesProvider settings={{ locale: 'en-gb', firstDayOfWeek: 1 }}>
        <ModalsProvider>
          <Notifications position="top-center" limit={3} autoClose={2500} />
          {buddyToken ? <BuddyPage token={buddyToken} /> : <App />}
        </ModalsProvider>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);
