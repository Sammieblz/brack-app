import { useState, useEffect } from 'react';
import { detectPlatform, type Platform } from '@/lib/platform';

export const usePlatform = () => {
  const [platform, setPlatform] = useState<Platform>('web');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return {
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isMobile: platform === 'ios' || platform === 'android',
  };
};
