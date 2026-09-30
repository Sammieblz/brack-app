import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';
const client = path.resolve(__dirname, '../../../apps/client');
const data = path.join(__dirname, 'data.ts');
const api = path.join(__dirname, 'api.ts');
// Target Library hooks remain real. Only unrelated shared shell state is reused.
const shellData = ['hooks/useBadges', 'hooks/useGamification', 'hooks/useFeatureFlags', 'hooks/useHapticFeedback',
  'hooks/useUserNotifications', 'hooks/useStreaks', 'hooks/useNetworkStatus', 'hooks/useBarcodeScanner', 'hooks/useImagePicker',
  'hooks/useJournalEntries', 'hooks/useConversations', 'hooks/useFollowing', 'contexts/TimerContext', 'contexts/ProfileContext',
  'contexts/ThemeContext', 'services/telemetry', 'services/imageCache', 'services/scannerBookFlow'];
export default defineConfig({
  cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/library-tasks'), root: __dirname,
  publicDir: path.join(client, 'public'), plugins: [react()],
  resolve: { alias: [
    { find: /^@\/services\/api(?:\/.*)?$/, replacement: api },
    ...['services/local', 'services/connectivity', 'services/sync/engine', 'utils/offlineOperation', 'services/onboarding'].map(name => ({ find: `@/${name}`, replacement: api })),
    { find: '@/hooks/useAuth', replacement: data },
    ...shellData.map(name => ({ find: `@/${name}`, replacement: data })),
    ...['@capacitor/core', '@capacitor/haptics', '@capacitor/browser', '@capacitor/app-launcher', '@capacitor/app', '@capacitor/share']
      .map(find => ({ find, replacement: path.join(__dirname, 'devices.ts') })),
    { find: '@', replacement: path.join(client, 'src') },
  ] },
  css: { postcss: { plugins: [tailwindcss({ ...baseTailwind, content: [path.join(client, 'src/**/*.{ts,tsx}'), path.join(__dirname, '**/*.{ts,tsx}')] }), autoprefixer()] } },
  server: { host: '127.0.0.1', port: 8097, strictPort: true, hmr: false, fs: { allow: [path.resolve(__dirname, '../../..')] }, watch: { ignored: ['**/*.{test,spec}.{ts,tsx}'] } },
});
