import path from 'node:path';
import base from '../library-tasks/vite.config';
const aliases = base.resolve?.alias;
if (!Array.isArray(aliases)) throw new Error('Expected aliases');
export default { ...base, root: __dirname, cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/reading-session'),
  resolve: { alias: [
    { find: '@/contexts/TimerContext', replacement: path.resolve(__dirname, '../../../apps/client/src/contexts/TimerContext.tsx') },
    { find: '@/hooks/useJournalEntries', replacement: path.resolve(__dirname, '../../../apps/client/src/hooks/useJournalEntries.ts') },
    ...['hooks/useGamification', 'hooks/useDashboardHomeData', 'hooks/useFeatureFlags'].map(name => ({ find: `@/${name}`, replacement: path.join(__dirname, 'journey.ts') })),
    { find: '@/services/timerNative', replacement: path.join(__dirname, 'native.ts') },
    { find: '@/hooks/useImagePicker', replacement: path.resolve(__dirname, '../reading-progress/image-picker.ts') },
    ...['hooks/useDashboardHomeData', 'hooks/useOnboardingStatus', 'hooks/useFeatureFlags', 'hooks/useConfirmedRewardFeedback', 'hooks/useStreakCelebration', 'hooks/useGoals'].map(name => ({ find: `@/${name}`, replacement: path.resolve(__dirname, '../reading-progress/dashboard.ts') })),
    ...aliases.map(alias => ({ ...alias, replacement: alias.replacement.replace(/library-tasks[\\/]api.ts$/, 'reading-session/api.ts') })),
  ] }, server: { ...base.server, port: 8106 } };
