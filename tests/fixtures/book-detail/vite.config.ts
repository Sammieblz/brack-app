import path from 'node:path';
import base from '../library-tasks/vite.config';
const aliases = base.resolve?.alias;
if (!Array.isArray(aliases)) throw new Error('Expected explicit aliases');
export default { ...base, root: __dirname, cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/book-detail'),
  resolve: { alias: aliases.map(alias => ({ ...alias, replacement: alias.find === '@/contexts/TimerContext' ? path.join(__dirname, 'timer.ts') : alias.replacement.replace(/library-tasks[\\/]api.ts$/, 'book-detail/api.ts') })) },
  server: { ...base.server, port: 8104 } };
