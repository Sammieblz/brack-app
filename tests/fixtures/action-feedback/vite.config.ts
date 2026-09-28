import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';
const client = path.resolve(__dirname, '../../../apps/client');
export default defineConfig({
  cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/action-feedback'),
  root: __dirname, publicDir: path.join(client, 'public'), plugins: [react()],
  resolve: { alias: [
    { find: /^@\/services\/api$/, replacement: path.join(__dirname, 'adapters.ts') },
    ...['@capacitor/core', '@capacitor/app', '@capacitor/haptics', '@capacitor/browser', '@capacitor/app-launcher', '@/utils/offlineOperation', '@/services/local', '@/hooks/useBooks', '@/hooks/useReadingProfile']
      .map((find) => ({ find, replacement: path.join(__dirname, 'adapters.ts') })),
    ...['components/MobileLayout', 'components/MobileHeader', 'components/BarcodeScannerFlow']
      .map((module) => ({ find: `@/${module}`, replacement: path.join(__dirname, 'surfaces.tsx') })),
    { find: '@', replacement: path.join(client, 'src') },
  ] },
  css: { postcss: { plugins: [tailwindcss({ ...baseTailwind,
    content: [path.join(client, 'src/**/*.{ts,tsx}'), path.join(__dirname, '**/*.{ts,tsx}')],
  }), autoprefixer()] } },
  server: { host: '127.0.0.1', port: 8088, strictPort: true, hmr: false,
    fs: { allow: [path.resolve(__dirname, '../../..')] }, watch: { ignored: ['**/*.{test,spec}.{ts,tsx}'] } },
});
