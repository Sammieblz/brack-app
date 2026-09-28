import { getRuntimePlatform } from '@/services/platform';

// Legacy presentation adapter. Browser/PWA user agents never imply native APIs.

export type Platform = 'ios' | 'android' | 'web';

export const detectPlatform = (): Platform => {
  const runtime = getRuntimePlatform();
  return runtime === 'ios' || runtime === 'android' ? runtime : 'web';
};

export const getPlatformStyles = (platform: Platform) => {
  const styles = {
    ios: {
      borderRadius: '12px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
      buttonRadius: '10px',
      cardRadius: '12px',
      inputRadius: '10px',
    },
    android: {
      borderRadius: '16px',
      fontFamily: 'Inter, Roboto, "Noto Sans", system-ui, sans-serif',
      buttonRadius: '20px',
      cardRadius: '16px',
      inputRadius: '4px',
    },
    web: {
      borderRadius: '8px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      buttonRadius: '8px',
      cardRadius: '8px',
      inputRadius: '6px',
    },
  };
  
  return styles[platform];
};

export const isIOS = () => detectPlatform() === 'ios';
export const isAndroid = () => detectPlatform() === 'android';
export const isMobile = () => {
  const platform = detectPlatform();
  return platform === 'ios' || platform === 'android';
};
