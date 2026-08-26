# Mobile Features

Complete guide to Brack's native mobile capabilities powered by Capacitor.

## Overview

Brack uses Capacitor 7 to provide native mobile functionality while maintaining a unified web codebase. Capacitor config lives in `apps/mobile/capacitor.config.ts`; the native `android/` and `ios/` projects intentionally remain at the repository root.

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
# Build web assets and sync to native projects
npm run cap:sync

# Open native IDEs
npm run cap:open:ios      # macOS only
npm run cap:open:android
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
<string>Allow Brack to scan book barcodes and attach photos to your library.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Allow Brack to let you pick cover images from your library.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Allow Brack to save a photo only when you choose to keep it.</string>
```

Android (`AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

These declarations make a permission available; they do not request it. Brack
shows the OS camera or photo picker only after the reader selects a scanner,
photo attachment, or image-picker action. Declining must leave a recoverable
manual/file path. Do not add broad storage/media permission for the system
photo picker.

### 2. Barcode Scanning

**Libraries**:
- Native iOS/Android: `@capacitor/barcode-scanner`
- Web/PWA/Desktop fallback: `@zxing/library@0.21.3` with `navigator.mediaDevices.getUserMedia`

**Features**:
- Scan ISBN-10, ISBN-13, EAN-13 ISBN barcodes, and QR payloads that contain a valid ISBN
- Validate ISBN checksums before lookup
- Show a live camera preview and viewfinder on web/desktop
- Use the native scanner camera surface on iOS/Android
- Resolve scanned ISBNs through the `search-books` provider gateway
- Require an exact normalized ISBN metadata match before adding
- Confirm the matched book preview before saving to the library
- Detect duplicate books and restore soft-deleted matches through `add-book`

**Usage**:

```typescript
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

const { startScan, scannedCode, isScanning } = useBarcodeScanner();

const handleScan = async () => {
  const isbn = await startScan();
  if (isbn) {
    // Resolve exact metadata match, preview, then add through add-book
  }
};
```

**Screens/components**:
- `apps/client/src/components/BarcodeScannerFlow.tsx` - shared scan, lookup, preview, add state machine
- `apps/client/src/screens/ScanBarcode.tsx` - standalone scanner route
- `apps/client/src/screens/AddBook.tsx` - `Scan` tab and manual ISBN scanner control

See [Book Acquisition, Search, And Barcode Scanning](./reading/book-acquisition.md) for the full scanner-to-library flow.

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

**Screen**: `apps/client/src/screens/ScanCover.tsx`

### 4. Push Notifications

**Plugins**: `@capacitor/push-notifications@7.0.4` on Android and
`@capacitor-firebase/messaging@7.5.0` for an FCM registration token on iOS.

**Features**:
- FCM HTTP v1 delivery through the `send-push-notification` Edge Function
- Background notifications
- Notification actions
- Authenticated, per-installation token ownership
- Explicit post-signup consent; no automatic permission prompt at app startup

**Setup**:

1. **Firebase Project**: Create at [console.firebase.google.com](https://console.firebase.google.com)

2. **Android**:
   - Add Android app to Firebase
   - Download `google-services.json`
   - Place in `android/app/google-services.json`
   - Add FCM Server Key to environment variables

3. **iOS**:
   - Add iOS app to Firebase
   - Upload the APNs authentication key/certificate to the same Firebase project
   - Download `GoogleService-Info.plist`
   - Add to Xcode project
   - Enable the Apple App ID and Xcode **Push Notifications** capability
   - Sign with a provisioning profile carrying the `aps-environment` entitlement
   - Test receipt on a physical signed device; the simulator is not release proof

**Usage**:

```typescript
import { usePushNotifications } from '@/hooks/usePushNotifications';

const { register, isRegistered, token } = usePushNotifications();

// Call only after the reader presses the notification enable action.
await register();
```

**Service**: `apps/client/src/services/pushNotifications.ts`

Capacitor's generic Push Notifications plugin reports a native APNs token on
iOS, but Brack's server sends FCM HTTP v1 messages. The iOS registration path
therefore uses Firebase Messaging to obtain the FCM token expected by the
server; storing an APNs token in `push_tokens` would not make that transport
work. Repository configuration alone is insufficient: Firebase must have valid
APNs credentials and the signed Apple target must carry the capability before
iOS remote push is production-ready.

`public.claim_push_token(text, text)` assigns a token atomically to the verified
current user. The token is globally unique, so signing into another account on
the same installation transfers ownership instead of leaving a copy on both
accounts. Sign-out deletes and unregisters only the current installation token;
tokens for the reader's other devices remain intact. Never log full device
tokens.

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

Local-notification permission is requested from a deliberate action: the
post-signup notification choice, or the first timer start when the reader
skipped that choice. Mounting `App` or `TimerContext` only installs listeners;
it does not open an OS prompt.

### Permission education and timing

`/app-permissions` is a native-only education screen shown after a verified new
reader's onboarding draft has been applied. It checks notification status
without prompting, explains the value of reminders, offers an explicit enable
button, and always offers a continue-without-notifications path. Its completion
marker is local and namespaced by Auth user; the OS remains authoritative.
Web/PWA and Electron bypass this page.

| Capability | When the OS prompt may appear | If declined |
| --- | --- | --- |
| Remote/local notifications | Explicit native post-signup enable action; local notifications may retry at the first timer start | Continue normally; do not repeatedly prompt. Reader can use system settings later. |
| Camera | After Scan barcode, Scan cover, or Take photo | Keep manual ISBN/search/file-entry routes available. |
| Photo library/add-only | After Choose image or an explicit save-to-library action | Keep the form usable without the image. |
| Foreground location | After **Use current location** in profile/discovery setup | Manual city/region entry remains available. |

Brack does not request camera, photos, or location as part of onboarding. It
does not request background location, broad media/storage access, exact alarms,
or an unrelated permission bundle merely to increase grant rates.

### 6. Foreground Location

**Plugin**: `@capacitor/geolocation` on native platforms; browser geolocation
remains the web fallback.

iOS (`Info.plist`):

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Allow Brack to use your location when you choose nearby reader discovery.</string>
```

Android (`AndroidManifest.xml`):

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Only foreground, user-initiated lookup is in scope. Do not add background
location. Profile visibility and `show_location` still control whether saved
coordinates participate in nearby discovery.

### 7. Haptic Feedback

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

**Hook**: `apps/client/src/hooks/useHapticFeedback.ts`

### 8. Share

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

**Service**: `apps/client/src/services/shareService.ts`

### 9. Network Status

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
  // Save supported reading-core changes locally for sync
}
```

**Hook**: `apps/client/src/hooks/useNetworkStatus.ts`

### 10. Filesystem

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

**Service**: `apps/client/src/services/imageCache.ts`

### 11. Device Information

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

**Hook**: `apps/client/src/hooks/usePlatform.ts`

### 12. App Lifecycle

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
    // Sync reading-core outbox
  } else {
    // App went to background
    // Save state
  }
});
```

**Used in**: 
- `apps/client/src/contexts/TimerContext.tsx` - Timer persistence
- `apps/client/src/services/syncService.ts` - Background sync
- `apps/client/src/services/deepLinkService.ts` - Deep links

## App Icons

Capacitor launcher icons use the fixed Brack `B` mark on the orange app field:

- iOS source icon: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Android adaptive icon layers: `android/app/src/main/res/mipmap-*/ic_launcher_background.png` and `ic_launcher_foreground.png`
- Android legacy launcher icons: `android/app/src/main/res/mipmap-*/ic_launcher.png` and `ic_launcher_round.png`
- Canonical source: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`; run `npm run brand:icons` to regenerate platform-specific icon outputs.

Run `npm run brand:icons` and then `npm run media:assets` after changing Brack app icon artwork. Android adaptive icons include a monochrome layer through `ic_launcher_foreground` for themed launcher support. Runtime UI logos remain theme-aware through `apps/client/src/components/ThemeAwareLogo.tsx`; the UI uses only the transparent `brack-mark.webp` and `brack-wordmark.webp` masks, while opaque launcher canvases remain platform-specific outputs.

## Deep Linking

**URL Scheme**: `brack://`

**Verified-link target**: `https://brack-app.com` (not active until the web
domain and platform association documents are deployed and verified)

**Supported Links**:
- `brack://book/123` - Open book detail
- `brack://user/456` - Open user profile
- `brack://message/789?conversationId=abc` - Open message
- `brack://club/101` - Open book club
- `brack://list/202` - Open book list
- `brack://auth/callback` - Complete Supabase Auth callbacks
- `brack://auth/reset-password` - Complete password recovery and open the reset screen

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

Production content links can also use verified HTTPS links:

- Android declares `android:autoVerify="true"` App Links only for the supported
  `/book/`, `/user/`, `/message/`, `/club/`, and `/list/` content paths. It does
  not claim `/auth/*`, so an HTTPS email fallback stays in the browser. The site must serve
  `/.well-known/assetlinks.json` containing `com.brack.app` and the real release
  signing certificate SHA-256 fingerprint.
- iOS requires the Associated Domains entitlement
  `applinks:brack-app.com`. The site must serve the extensionless
  `/.well-known/apple-app-site-association` document containing the real Apple
  Team ID and bundle ID `com.brack.app`. When Universal Links are enabled, the
  association rules must likewise exclude `/auth/*`; current Auth return uses
  the registered `brack://` scheme.
- Both association documents must be public HTTPS responses with status 200,
  the correct JSON content type, and no redirect. Do not commit placeholder
  identifiers. Keep `brack://` as the installed-app fallback.

**Services**:
- `apps/client/src/services/deepLinkService.ts` routes content deep links and forwards auth callbacks.
- `apps/client/src/components/DeepLinkHandler.tsx` completes `brack://auth/callback` and `brack://auth/reset-password` by exchanging the Supabase code/session and delegating to the shared resolver, which can route to draft recovery, native permission education, dashboard, or password reset.
- `@capacitor/browser` opens OAuth providers outside the WebView and closes on return where supported.
- The PWA service worker is not registered inside Capacitor. Native Auth state
  remains in the WebView while only flows that require a provider/browser leave it.

## Offline Support

### Features

1. **Durable Outbox** - Reading-core mutations queued when offline
2. **Data Caching** - Frequently accessed data cached
3. **Image Caching** - Book covers and images cached
4. **Background Sync** - Auto-sync on reconnect

### Implementation

**Reading-Core Sync**:
```typescript
import { readingCoreSync } from '@/services/sync/engine';

// Check current sync state
const status = await readingCoreSync.getStatus();

// Sync when online
await readingCoreSync.syncCurrentUser();
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
| Location | Capacitor foreground geolocation | Browser geolocation after the same explicit action |
| Share | Native share sheet | Web Share API or copy link |
| Haptics | Device vibration | No vibration |
| Push Notifications | FCM transport | No web-push registration in the current client; in-app notifications/preferences remain |
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
npm --workspace @brack/mobile exec cap run ios
```

**Limitations**:
- No camera
- No push notifications
- No haptics
- Different performance

### Android Emulator

```bash
npm --workspace @brack/mobile exec cap run android
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
- Solution: Run `npm run cap:sync` after adding plugins

**"Permission denied"**:
- Solution: Check permissions in Info.plist (iOS) or AndroidManifest.xml (Android)

## Further Reading

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Getting Started](./getting-started.md)
- [Architecture](./architecture.md)
- [Troubleshooting](./troubleshooting.md)
