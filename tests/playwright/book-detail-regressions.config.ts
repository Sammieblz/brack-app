import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import base from './library-tasks.config';
export default defineConfig({ ...base,
  grep: /BookDetail:/,
  outputDir: '../../test-results/f11a-membership',
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../../test-results/f11a-membership.json', import.meta.url)) }]],
});
