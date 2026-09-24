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
import { theme } from './theme';

dayjs.locale('en-gb');
registerSW({ immediate: true });

if (cloudEnabled) {
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
          <App />
        </ModalsProvider>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);
