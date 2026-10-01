import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';
import path from 'node:path';
export default mergeConfig(base, defineConfig({
  cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/lists-renewal'),
  server: { port: 8102 },
}));
