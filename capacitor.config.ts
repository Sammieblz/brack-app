import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brack.app',
  appName: 'Brack',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#0b1021',
  loggingBehavior: process.env.NODE_ENV === 'production' ? 'none' : 'debug',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
