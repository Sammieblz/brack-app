import path from 'node:path';
import base from '../library-tasks/vite.config';
const aliases = base.resolve?.alias;
if (!Array.isArray(aliases)) throw new Error('Expected aliases');
export default { ...base, root: __dirname, cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/reading-progress'),
  resolve: { alias: [
    { find: '@/hooks/useImagePicker', replacement: path.join(__dirname, 'image-picker.ts') },
    ...['hooks/useDashboardHomeData', 'hooks/useOnboardingStatus', 'hooks/useFeatureFlags', 'hooks/useConfirmedRewardFeedback', 'hooks/useStreakCelebration', 'hooks/useGoals'].map(name => ({ find: `@/${name}`, replacement: path.join(__dirname, 'dashboard.ts') })),
    ...aliases.map(alias => ({ ...alias, replacement: alias.replacement.replace(/library-tasks[\\/]api.ts$/, 'reading-progress/api.ts') })),
  ] }, server: { ...base.server, port: 8105 } };
