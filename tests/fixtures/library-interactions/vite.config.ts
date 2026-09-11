import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';

const client = path.resolve(__dirname, '../../../apps/client');

export default defineConfig({
  root: __dirname,
  publicDir: path.join(client, 'public'),
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('fixture-only-public-key'),
  },
  resolve: { alias: [
    { find: '@/hooks/useAuth', replacement: path.join(__dirname, 'auth.ts') },
    { find: '@', replacement: path.join(client, 'src') },
  ] },
  css: { postcss: { plugins: [tailwindcss({
    ...baseTailwind,
    content: [path.join(client, 'src/**/*.{ts,tsx}'), path.join(__dirname, '**/*.{ts,tsx}')],
  }), autoprefixer()] } },
  server: {
    host: '127.0.0.1', port: 8085, strictPort: true,
    hmr: false,
    fs: { allow: [path.resolve(__dirname, '../../..')] },
    watch: { ignored: ['**/*.{test,spec}.{ts,tsx}'] },
  },
});
