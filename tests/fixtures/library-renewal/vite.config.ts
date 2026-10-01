import path from 'node:path';
import base from '../library-tasks/vite.config';
const aliases = base.resolve?.alias;
if (!Array.isArray(aliases)) throw new Error('Expected explicit aliases');
export default { ...base, root: __dirname, cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/library-renewal'),
  resolve: { alias: aliases.map(alias => ({ ...alias, replacement: alias.replacement.replace(/library-tasks[\\/]api.ts$/, 'library-renewal/api.ts') })) },
  server: { ...base.server, port: 8101 } };
