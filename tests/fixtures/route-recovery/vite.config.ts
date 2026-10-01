import path from 'node:path';
import base from '../library-tasks/vite.config';
const aliases = base.resolve?.alias;
if (!Array.isArray(aliases)) throw new Error('Expected explicit fixture aliases');
export default {
  ...base, root: __dirname, cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/route-recovery'),
  resolve: { alias: [
    { find: '@/components/auth/AuthTurnstile', replacement: path.join(__dirname, 'captcha.tsx') },
    ...aliases.map(alias => ({ ...alias, replacement: alias.replacement
      .replace(/library-tasks[\\/]api.ts$/, 'route-recovery/api.ts')
      .replace(/library-tasks[\\/]data.ts$/, 'route-recovery/data.ts') })),
  ] },
  server: { ...base.server, port: 8100 },
};
