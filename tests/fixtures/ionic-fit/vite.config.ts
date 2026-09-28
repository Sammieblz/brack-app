import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import baseTailwind from '../../../apps/client/tailwind.config';

const client = path.resolve(__dirname, '../../../apps/client');
const rewrite = (url?: string) => url?.startsWith('/navigation.html/')
  ? `/navigation.html${url.includes('?') ? url.slice(url.indexOf('?')) : ''}` : url;

export default defineConfig({
  root: __dirname, publicDir: false,
  plugins: [react(), {
    name: 'ionic-navigation-entry',
    configureServer(server) { server.middlewares.use((req, _res, next) => { req.url = rewrite(req.url); next(); }); },
    configurePreviewServer(server) { server.middlewares.use((req, _res, next) => { req.url = rewrite(req.url); next(); }); },
  }],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
    alias: [
      { find: '@/hooks/useHapticFeedback', replacement: path.join(__dirname, 'haptics.ts') },
      { find: /^@capacitor\/(core|browser|app-launcher)$/, replacement: path.join(__dirname, 'device.ts') },
      { find: '@', replacement: path.join(client, 'src') },
    ],
  },
  css: { postcss: { plugins: [tailwindcss({ ...baseTailwind,
    content: [path.join(client, 'src/**/*.{ts,tsx}'), path.join(__dirname, '*.{ts,tsx}')],
  }), autoprefixer()] } },
  server: { host: '127.0.0.1', port: 8090, strictPort: true, hmr: false,
    fs: { allow: [path.resolve(__dirname, '../../..')] },
    watch: { ignored: ['**/*.{test,spec}.{ts,tsx}'] } },
  preview: { host: '127.0.0.1', port: 8091, strictPort: true },
  build: { manifest: true, rollupOptions: { input: {
    primitives: path.join(__dirname, 'index.html'),
    baseline: path.join(__dirname, 'baseline.html'),
    navigation: path.join(__dirname, 'navigation.html'),
  } } },
});
