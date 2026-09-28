import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';

const client = path.resolve(__dirname, '../../../apps/client');
const adapters = path.join(__dirname, 'adapters.ts');

export default defineConfig({
  cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/journal-save'),
  root: __dirname,
  publicDir: path.join(client, 'public'),
  plugins: [react()],
  resolve: { alias: [
    { find: /^@\/services\/api$/, replacement: path.join(__dirname, 'api.ts') },
    ...['hooks/useAuth', 'hooks/useImagePicker', 'services/local', 'services/connectivity',
      'services/api/client', 'utils/offlineOperation', 'utils/bookStatus'].map((module) => ({
      find: `@/${module}`, replacement: adapters,
    })),
    { find: '@', replacement: path.join(client, 'src') },
  ] },
  css: { postcss: { plugins: [tailwindcss({
    ...baseTailwind,
    content: [path.join(client, 'src/**/*.{ts,tsx}'), path.join(__dirname, '**/*.{ts,tsx}')],
  }), autoprefixer()] } },
  server: {
    host: '127.0.0.1', port: 8086, strictPort: true, hmr: false,
    fs: { allow: [path.resolve(__dirname, '../../..')] },
    watch: { ignored: ['**/*.{test,spec}.{ts,tsx}'] },
  },
});
