import { useUIEnvironmentValue } from './useUIEnvironment';
import type { Platform } from '@/lib/platform';

export const usePlatform = () => {
  const runtime = useUIEnvironmentValue((environment) => environment.runtime);
  const platform: Platform = runtime === 'ios' || runtime === 'android' ? runtime : 'web';

  return {
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isMobile: platform === 'ios' || platform === 'android',
  };
};
