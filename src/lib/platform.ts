// Platform detection utilities for iOS/Android specific features

export type Platform = 'ios' | 'android' | 'web';

export const detectPlatform = (): Platform => {
  if (typeof window === 'undefined') return 'web';
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  
  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  return 'web';
};

export const getPlatformStyles = (platform: Platform) => {
  const styles = {
    ios: {
      borderRadius: '12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"',
      buttonRadius: '10px',
      cardRadius: '12px',
      inputRadius: '10px',
    },
    android: {
      borderRadius: '16px',
      fontFamily: 'Roboto, "Noto Sans", system-ui',
      buttonRadius: '20px',
      cardRadius: '16px',
      inputRadius: '4px',
    },
    web: {
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
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
