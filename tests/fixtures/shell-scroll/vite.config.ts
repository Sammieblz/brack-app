import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';

const client = path.resolve(__dirname, '../../../apps/client');
const mocks = path.resolve(__dirname, 'mocks.tsx');
const mockedModules = [
  'hooks/useAuth', 'hooks/useBooks', 'hooks/useReadingProfile', 'hooks/useBadges',
  'hooks/useGamification', 'hooks/useFeatureFlags', 'hooks/useHapticFeedback',
  'contexts/ProfileContext', 'contexts/TimerContext',
  'components/AppSidebar', 'components/HeaderTimerWidget', 'components/ProfileDrawer',
  'components/UserNotificationsPopover', 'components/AddToListDialog',
  'components/BadgeDetailsDialog', 'components/FloatingActionButton',
  'components/journey/JourneyOverview', 'components/journey/JourneyQuests',
  'components/journey/JourneyShop', 'components/journey/JourneyBadges',
  'components/journey/JourneyLeague', 'components/journey/JourneyFreshnessNotice',
  'services/api/books', 'services/api/profiles', 'services/api/gamification',
  'services/telemetry', 'utils/offlineOperation', 'services/connectivity',
];

export default defineConfig({
  root: __dirname,
  publicDir: path.join(client, 'public'),
  plugins: [react()],
  resolve: {
    alias: [
      ...mockedModules.map((name) => ({ find: `@/${name}`, replacement: mocks })),
      { find: '@', replacement: path.join(client, 'src') },
    ],
  },
  css: { postcss: { plugins: [tailwindcss({
    ...baseTailwind,
    content: [path.join(client, 'src/**/*.{ts,tsx}'), path.join(__dirname, '**/*.{ts,tsx}')],
  }), autoprefixer()] } },
  server: { host: '127.0.0.1', port: 8082, strictPort: true, fs: { allow: [path.resolve(__dirname, '../../..')] } },
});
