import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brack.app',
  appName: 'Brack',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#0b1021', // Dark background for splash screens (matches Brack dark theme)
  loggingBehavior: process.env.NODE_ENV === 'production' ? 'none' : 'debug',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
  app: {
    // Deep linking configuration
    customUrlScheme: 'brack',
  },
  // Optional: SplashScreen plugin configuration
  // Uncomment after installing @capacitor/splash-screen: npm install @capacitor/splash-screen
  // plugins: {
  //   SplashScreen: {
  //     launchShowDuration: 2000,
  //     launchAutoHide: true,
  //     backgroundColor: '#0b1021',
  //     androidSplashResourceName: 'splash',
  //     androidScaleType: 'CENTER_CROP',
  //     showSpinner: false,
  //     iosSpinnerStyle: 'small',
  //     spinnerColor: '#F97316', // Brack's default orange primary color
  //   },
  // },
};

export default config;
