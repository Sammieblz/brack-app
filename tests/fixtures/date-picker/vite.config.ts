import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';

const client = path.resolve(__dirname, '../../../apps/client');

export default defineConfig({
  root: __dirname,
  publicDir: false,
  plugins: [react()],
  resolve: { alias: { '@': path.join(client, 'src') } },
  css: { postcss: { plugins: [tailwindcss({
    ...baseTailwind,
    content: [
      path.join(client, 'src/**/*.{ts,tsx}'),
      path.join(__dirname, '**/*.{ts,tsx}'),
      `!${path.join(client, 'src/**/*.{test,spec}.{ts,tsx}')}`,
    ],
  }), autoprefixer()] } },
  server: {
    host: '127.0.0.1',
    port: 8083,
    strictPort: true,
    fs: { allow: [path.resolve(__dirname, '../../..')] },
    watch: { ignored: ['**/*.{test,spec}.{ts,tsx}'] },
  },
});
