import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';
const client = path.resolve(__dirname, '../../../apps/client');
const data = path.join(__dirname, 'data.ts');
const api = path.join(__dirname, 'api.ts');
// Only unrelated shell state reuses the earlier fixture. All Settings forms,
// their own hooks, image/date pickers, profile/theme contexts and guards are real.
const shellData = ['hooks/useBooks', 'hooks/useBadges', 'hooks/useGamification', 'hooks/useFeatureFlags', 'hooks/useHapticFeedback',
  'hooks/useUserNotifications', 'hooks/useStreaks', 'hooks/useBookLists', 'hooks/useNetworkStatus', 'hooks/useBarcodeScanner',
  'hooks/useJournalEntries', 'contexts/TimerContext', 'services/telemetry', 'utils/offlineOperation',
  'services/connectivity', 'services/sync/engine', 'services/imageCache', 'services/scannerBookFlow'];
export default defineConfig({
  cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/settings-continuity'), root: __dirname,
  publicDir: path.join(client, 'public'), plugins: [react()],
  resolve: { alias: [
    { find: /^@\/services\/api(?:\/.*)?$/, replacement: api },
    { find: '@/integrations/supabase/client', replacement: api },
    { find: '@/services/onboarding', replacement: api },
    { find: '@/services/dataPortability', replacement: path.join(__dirname, 'portability.ts') },
    { find: '@/services/pushNotifications', replacement: path.join(__dirname, 'devices.ts') },
    { find: '@/hooks/useAuth', replacement: data },
    ...shellData.map((name) => ({ find: `@/${name}`, replacement: data })),
    ...['@capacitor/core', '@capacitor/haptics', '@capacitor/browser', '@capacitor/app-launcher', '@capacitor/app', '@capacitor/camera', '@capacitor/geolocation']
      .map((find) => ({ find, replacement: path.join(__dirname, 'devices.ts') })),
    { find: '@', replacement: path.join(client, 'src') },
  ] },
  css: { postcss: { plugins: [tailwindcss({ ...baseTailwind, content: [path.join(client, 'src/**/*.{ts,tsx}'), path.join(__dirname, '**/*.{ts,tsx}')] }), autoprefixer()] } },
  server: { host: '127.0.0.1', port: 8096, strictPort: true, hmr: false,
    fs: { allow: [path.resolve(__dirname, '../../..')] }, watch: { ignored: ['**/*.{test,spec}.{ts,tsx}'] } },
});
