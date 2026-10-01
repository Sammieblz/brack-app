import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import loading from './loading.config';
import interactions from './library-interactions.config';
import tasks from './library-tasks.config';
const suite = process.env.F10C_SUITE ?? 'interactions';
const run = process.env.F10C_RUN ?? 'final';
const configurations = { loading, interactions, tasks };
if (!(suite in configurations)) throw new Error(`Unknown regression suite: ${suite}`);
export default defineConfig({ ...configurations[suite as keyof typeof configurations], workers: 1, fullyParallel: false,
  outputDir: `../../test-results/f10c-${suite}-${run}`,
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL(`../../test-results/f10c-${suite}-${run}.json`, import.meta.url)) }]],
});
