# Mobile Features

Complete guide to Brack's native mobile capabilities powered by Capacitor.

## Overview

Brack uses Capacitor 7 to provide native mobile functionality while maintaining a unified web codebase.

**Supported Platforms**:
- iOS 13+
- Android 5.0+ (API 24+)
- Web (with fallbacks)

## Setup

### Prerequisites

**iOS Development**:
- macOS computer
- Xcode 14+
- CocoaPods (`sudo gem install cocoapods`)
- Apple Developer account (for device testing)

**Android Development**:
- Android Studio
- Android SDK (API 24+)
- Java JDK 17+

### Initial Setup

```bash
# Build web assets
npm run build

# Sync to native projects
npx cap sync

# Open native IDEs
npx cap open ios      # macOS only
npx cap open android
```

## Available Features

### 1. Camera & Photo Library

**Plugin**: `@capacitor/camera@7.0.3`

**Features**:
- Take photos with camera
- Select from photo library
- Image compression
- Base64 encoding

**Usage**:

```typescript
import { useImagePicker } from '@/hooks/useImagePicker';

const { pickImage } = useImagePicker();

const handleSelectImage = async () => {
  const image = await pickImage({
    source: 'photos', // or 'camera'
    quality: 90,
  });
  
  if (image) {
    console.log('Image data URL:', image);
  }
};
```

**Permissions Required**:

iOS (`Info.plist`):
```xml
<key>NSCameraUsageDescription</key>
<string>To scan book covers and barcodes</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>To select book cover images</string>
```

Android (`AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### 2. Barcode Scanning

**Libraries**: `@zxing/library@0.21.3` + Capacitor Camera

**Features**:
- Scan ISBN-10 and ISBN-13
- Validate barcode format
- Haptic feedback on success

**Usage**:

```typescript
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

const { startScan, scannedCode, isScanning } = useBarcodeScanner();

const handleScan = async () => {
  const isbn = await startScan();
  if (isbn) {
    // Add book with ISBN
  }
};
```

**Screen**: `src/screens/ScanBarcode.tsx`

### 3. Cover Recognition (OCR)

**Library**: `tesseract.js@7.0.0`

**Features**:
- Extract book title from cover
- Extract author name
- Image preprocessing
- Confidence scores

**Usage**:

```typescript
import { useCoverScanner } from '@/hooks/useCoverScanner';

const { scanCover, isScanning, extractedInfo } = useCoverScanner();

const handleScanCover = async () => {
  const result = await scanCover();
  if (result) {
    console.log('Title:', result.title);
    console.log('Author:', result.author);
    console.log('Confidence:', result.confidence);
  }
};
```

**Screen**: `src/screens/ScanCover.tsx`

### 4. Push Notifications

**Plugin**: `@capacitor/push-notifications@7.0.4`

**Features**:
- FCM integration (Android & iOS)
- Background notifications
- Notification actions
- Token management

**Setup**:

1. **Firebase Project**: Create at [console.firebase.google.com](https://console.firebase.google.com)

2. **Android**:
   - Add Android app to Firebase
   - Download `google-services.json`
   - Place in `android/app/google-services.json`
   - Add FCM Server Key to environment variables

3. **iOS**:
   - Add iOS app to Firebase
   - Upload APNs certificate
   - Download `GoogleService-Info.plist`
   - Add to Xcode project
   - Enable Push Notifications capability

**Usage**:

```typescript
import { usePushNotifications } from '@/hooks/usePushNotifications';

const { register, isRegistered, token } = usePushNotifications();

// Register on app start (automatically done in App.tsx)
useEffect(() => {
  register();
}, []);
```

**Service**: `src/services/pushNotifications.ts`

### 5. Local Notifications

**Plugin**: `@capacitor/local-notifications@7.0.4`

**Features**:
- Schedule notifications
- Repeating notifications
- Notification actions
- Badge count management

**Usage**:

```typescript
import { LocalNotifications } from '@capacitor/local-notifications';

// Schedule notification
await LocalNotifications.schedule({
  notifications: [
    {
      title: 'Reading Reminder',
      body: 'Time for your daily reading!',
      id: 1,
      schedule: {
        at: new Date(Date.now() + 3600000), // 1 hour
      },
    },
  ],
});
```

**Used in**: Reading timer background notifications

### 6. Haptic Feedback

**Plugin**: `@capacitor/haptics@7.0.2`

**Features**:
- Impact feedback (light, medium, heavy)
- Notification feedback (success, warning, error)
- Selection feedback

**Usage**:

```typescript
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const { triggerHaptic } = useHapticFeedback();

// Trigger on user action
triggerHaptic('success'); // or 'warning', 'error', 'light', 'medium', 'heavy'
```

**Hook**: `src/hooks/useHapticFeedback.ts`

### 7. Share

**Plugin**: `@capacitor/share@7.0.3`

**Features**:
- Native share sheet
- Share text and URLs
- Share to social media apps
- Share reading stats and quotes

**Usage**:

```typescript
import { shareService } from '@/services/shareService';

// Share book
await shareService.shareBook({
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  isbn: '9780743273565',
});

// Share reading stats
await shareService.shareReadingStats({
  booksRead: 25,
  pagesRead: 7500,
  streak: 30,
});
```

**Service**: `src/services/shareService.ts`

### 8. Network Status

**Plugin**: `@capacitor/network@7.0.2`

**Features**:
- Online/offline detection
- Connection type detection
- Network change events

**Usage**:

```typescript
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const isOnline = useNetworkStatus();

if (!isOnline) {
  // Show offline message
  // Queue actions for sync
}
```

**Hook**: `src/hooks/useNetworkStatus.ts`

### 9. Filesystem

**Plugin**: `@capacitor/filesystem@7.1.6`

**Features**:
- File read/write
- Directory management
- Image caching
- Data persistence

**Usage**:

```typescript
import { imageCache } from '@/services/imageCache';

// Cache image
await imageCache.cache('book-cover-123', imageDataUrl);

// Get cached image
const cachedImage = await imageCache.get('book-cover-123');

// Clear old cache
await imageCache.cleanup();
```

**Service**: `src/services/imageCache.ts`

### 10. Device Information

**Plugin**: `@capacitor/device@7.0.2`

**Features**:
- Platform detection
- OS version
- Device model
- UUID

**Usage**:

```typescript
import { Capacitor } from '@capacitor/core';

const platform = Capacitor.getPlatform(); // 'ios', 'android', 'web'
const isNative = Capacitor.isNativePlatform();

if (isNative) {
  // Use native feature
} else {
  // Web fallback
}
```

**Hook**: `src/hooks/usePlatform.ts`

### 11. App Lifecycle

**Plugin**: `@capacitor/app@7.1.0`

**Features**:
- App state change events (active, background, inactive)
- URL open events (deep linking)
- Back button handling (Android)

**Usage**:

```typescript
import { App } from '@capacitor/app';

App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    // App came to foreground
    // Sync offline queue
  } else {
    // App went to background
    // Save state
  }
});
```

**Used in**: 
- `src/contexts/TimerContext.tsx` - Timer persistence
- `src/services/syncService.ts` - Background sync
- `src/services/deepLinkService.ts` - Deep links

## Deep Linking

**URL Scheme**: `brack://`

**Supported Links**:
- `brack://book/123` - Open book detail
- `brack://user/456` - Open user profile
- `brack://message/789?conversationId=abc` - Open message
- `brack://club/101` - Open book club
- `brack://list/202` - Open book list

**Configuration**:

iOS (`Info.plist`):
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>brack</string>
    </array>
  </dict>
</array>
```

Android (`AndroidManifest.xml`):
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="brack" />
</intent-filter>
```

**Service**: `src/services/deepLinkService.ts`

## Offline Support

### Features

1. **Offline Queue** - Actions queued when offline
2. **Data Caching** - Frequently accessed data cached
3. **Image Caching** - Book covers and images cached
4. **Background Sync** - Auto-sync on reconnect

### Implementation

**Offline Queue**:
```typescript
import { offlineQueue } from '@/services/offlineQueue';

// Queue action when offline
offlineQueue.enqueue({
  type: 'create_book',
  data: bookData,
});

// Sync when online
await offlineQueue.sync();
```

**Data Cache**:
```typescript
import { dataCache } from '@/services/dataCache';

// Set cache (2-minute TTL)
dataCache.set('books_user_123', books, 120000);

// Get from cache
const cached = dataCache.get('books_user_123');
```

**Image Cache**:
```typescript
import { imageCache } from '@/services/imageCache';

// Cache image (native filesystem)
await imageCache.cache(imageId, dataUrl);

// Get cached
const cached = await imageCache.get(imageId);
```

## Platform-Specific Features

### iOS Only

- **Swipe Back Gesture** - iOS-style swipe to go back
- **Pull to Dismiss** - Dismiss modals with pull gesture
- **Haptic Feedback** - Rich taptic engine support

### Android Only

- **Back Button** - Hardware back button support
- **Material Design** - Native material components
- **Status Bar Color** - Adaptive status bar

### Web Fallbacks

All native features have web fallbacks:

| Feature | Native | Web Fallback |
|---------|--------|--------------|
| Camera | Native camera | `<input type="file" accept="image/*">` |
| Share | Native share sheet | Web Share API or copy link |
| Haptics | Device vibration | No vibration |
| Push Notifications | FCM | Web Push API (optional) |
| File Storage | Filesystem plugin | localStorage/IndexedDB |

## Performance Optimization

### Battery Saving

1. **Unsubscribe from real-time when app hidden**:
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Unsubscribe from real-time
  } else {
    // Re-subscribe
  }
});
```

2. **Reduce animation on low battery**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

3. **Batch operations**:
```typescript
import { debounce, throttle } from '@/utils/batchOperations';

const debouncedSearch = debounce(search, 300);
const throttledScroll = throttle(onScroll, 100);
```

### Memory Management

1. **Virtual scrolling** for long lists
2. **Image lazy loading**
3. **Component lazy loading**
4. **Cache size limits** (100MB for images)

## Testing on Devices

### iOS Simulator

```bash
npx cap run ios
```

**Limitations**:
- No camera
- No push notifications
- No haptics
- Different performance

### Android Emulator

```bash
npx cap run android
```

**Limitations**:
- Camera available but limited
- Push notifications work with FCM
- Performance varies

### Physical Devices

**iOS**:
1. Connect iPhone via USB
2. Open in Xcode
3. Select device as target
4. Build and run
5. Trust developer certificate on device

**Android**:
1. Enable Developer Options on device
2. Enable USB Debugging
3. Connect via USB
4. Open in Android Studio
5. Select device and run

## Common Issues

### iOS Build Errors

**"No provisioning profile found"**:
- Solution: Select team in Xcode → Signing & Capabilities

**"CocoaPods error"**:
```bash
cd ios/App
pod deintegrate
pod install
cd ../..
```

### Android Build Errors

**"SDK location not found"**:
- Solution: Create `local.properties` in `android/`:
```
sdk.dir=/Users/username/Library/Android/sdk
```

**"Manifest merger failed"**:
- Solution: Check for conflicting permissions in `AndroidManifest.xml`

### Runtime Errors

**"Plugin not available"**:
- Solution: Run `npx cap sync` after adding plugins

**"Permission denied"**:
- Solution: Check permissions in Info.plist (iOS) or AndroidManifest.xml (Android)

## Further Reading

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Getting Started](./getting-started.md)
- [Architecture](./architecture.md)
- [Troubleshooting](./troubleshooting.md)
