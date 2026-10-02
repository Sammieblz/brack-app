import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';

const client = path.resolve(__dirname, '../../../apps/client');
const data = path.join(__dirname, 'data.ts');
const dataModules = ['hooks/useAuth', 'hooks/useBooks', 'hooks/useReadingProfile', 'hooks/useBadges',
  'hooks/useGamification', 'hooks/useFeatureFlags', 'hooks/useHapticFeedback', 'hooks/useFollowing',
  'hooks/useConversations', 'hooks/useUserNotifications', 'hooks/useStreaks', 'hooks/useBookLists', 'hooks/useNetworkStatus',
  'hooks/useBarcodeScanner', 'hooks/useImagePicker', 'hooks/useJournalEntries',
  'contexts/ProfileContext', 'contexts/TimerContext', 'contexts/ThemeContext',
  'services/api/books', 'services/api/profiles', 'services/api/gamification', 'services/api/client',
  'services/api', 'services/local', 'services/telemetry', 'utils/offlineOperation', 'services/connectivity', 'services/sync/engine', 'services/imageCache', 'services/scannerBookFlow'];
export default defineConfig({
  cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/adaptive-shell'),
  root: __dirname, publicDir: path.join(client, 'public'), plugins: [react()],
  resolve: { alias: [
    ...dataModules.map((name) => ({ find: `@/${name}`, replacement: data })),
    ...['@capacitor/core', '@capacitor/haptics', '@capacitor/browser', '@capacitor/app-launcher', '@capacitor/app']
      .map((find) => ({ find, replacement: path.join(__dirname, 'adapters.ts') })),
    { find: '@', replacement: path.join(client, 'src') },
  ] },
  css: { postcss: { plugins: [tailwindcss({ ...baseTailwind,
    content: [path.join(client, 'src/**/*.{ts,tsx}'), path.join(__dirname, '**/*.{ts,tsx}')],
  }), autoprefixer()] } },
  server: { host: '127.0.0.1', port: 8093, strictPort: true, hmr: false,
    fs: { allow: [path.resolve(__dirname, '../../..')] }, watch: { ignored: ['**/*.{test,spec}.{ts,tsx}'] } },
});
