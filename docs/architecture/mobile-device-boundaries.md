# Mobile and Device Boundaries

Source date: 2026-08-26  
Scope: isolate Capacitor/device-specific behavior, onboarding permission timing,
and installation-scoped push identity.

## Current Boundary Map

| Capability | Current owner | Web fallback |
| --- | --- | --- |
| Barcode scanning | `apps/client/src/hooks/useBarcodeScanner.ts` | Live `getUserMedia` video preview scanned by ZXing. Requires HTTPS or localhost. |
| Cover OCR | `apps/client/src/hooks/useCoverScanner.ts`, `apps/client/src/utils/ocrHelpers.ts` | Photo picker/OCR in browser. |
| Generic image picking | `apps/client/src/hooks/useImagePicker.ts` | File input fallback. |
| Foreground location | Native geolocation wrapper used by the explicit **Use current location** action | Browser geolocation after the same action; manual location remains available. |
| Post-signup permission education | `apps/client/src/screens/PostSignupPermissions.tsx`, `apps/client/src/services/postSignupPermissions.ts` | Bypassed on web/PWA/Electron. |
| Push registration | `apps/client/src/services/pushNotifications.ts`, `apps/client/src/hooks/usePushNotifications.ts` | Listener-only/no registration with clear unsupported state. |
| Push send API | `apps/client/src/services/api/notifications.ts` and `send-push-notification` Edge Function | Server-side send only. |
| Badge push orchestration | `apps/client/src/services/badgeNotifications.ts` | No-op on web. |
| Image cache/filesystem | `apps/client/src/services/imageCache.ts` | Browser cache/data URL path. |
| Offline DB | `apps/client/src/services/local/driver.ts` | Dexie on web, SQLite on native. |
| App lifecycle sync | `apps/client/src/services/syncService.ts` | Browser `visibilitychange`; native Capacitor App plugin. |
| Haptics | `apps/client/src/hooks/useHapticFeedback.ts` | No-op on web. |
| Sharing | `apps/client/src/services/shareService.ts` | Web Share API / clipboard fallback. |
| Timer notifications and app-state bridge | `apps/client/src/services/timerNative.ts`, used by `apps/client/src/contexts/TimerContext.tsx` | Native local notifications only; web is a no-op. |

## Boundary Rule

- Domain services should not depend on Capacitor.
- Device integrations should live in hooks or platform services.
- Components should call hooks/services, not raw Capacitor plugins.
- Native-only behavior must have an explicit web no-op or fallback.
- Declaring a native permission does not authorize an automatic prompt. Request
  it only from a deliberate reader action after explaining the benefit.
- Permission education and OS state are separate. Local markers may remember
  that an intro was shown, but only the platform can grant access.
- Never request background location, broad media/storage access, or another
  capability that the invoked feature does not require.

## Permission lifecycle

```text
authenticated onboarding finalized
  -> native only: optional permission education
       -> Enable notifications -> OS prompt -> token claim if granted
       -> Continue -> dashboard without a grant

feature action later
  -> timer start -> local-notification request if still needed
  -> scan/take photo/choose image -> camera or photo picker request
  -> Use current location -> foreground-location request
```

The post-signup marker is namespaced by Auth user and installation. Web/PWA and
Electron skip it. Camera, photos, and location stay out of onboarding because
the reader has not invoked those features yet and must retain a manual path.

## Current State

- `TimerContext` owns timer state and UI events; native app-state and Local Notification plugin calls live in `timerNativeService`.
- `useBadges` owns badge UI/toast behavior; native badge push dispatch lives in `badgeNotificationService`.
- `usePushNotifications` delegates platform detection and plugin calls to `pushNotificationsService`.
- Push listeners may initialize at app startup, but registration and its OS
  prompt must not. Registration listeners are attached before provider
  registration so the first token/error event cannot be missed.
- Android uses the Capacitor push plugin's FCM token. iOS uses Firebase
  Messaging because the server transport is FCM HTTP v1 and the generic
  Capacitor plugin reports an APNs token on iOS. Valid APNs credentials in the
  Firebase project, the Apple Push capability, and physical-device QA remain
  deployment prerequisites.
- `claim_push_token` atomically assigns a globally unique installation token to
  the verified current user. Sign-out unregisters/deletes only that
  installation, preserving the reader's other devices.
- `TimerContext` requests local-notification access only from a deliberate
  timer start when the post-signup choice did not already settle it.
- Camera/OCR/barcode code is isolated in hooks with web fallbacks. Barcode scanning uses `@capacitor/barcode-scanner` on native platforms and the same visible `<video>` element plus ZXing on web/desktop. If scanner behavior grows, move plugin-specific scanner orchestration into a scanner service.

## Recommendation

Keep device calls out of domain API modules. A screen may orchestrate education
and state, but plugin calls stay behind platform services/hooks. Native release
QA must cover grant, deny, previously denied, reinstall/account-switch, and
system-settings changes for notifications, timer alerts, camera/photos, and
foreground location on physical Android and iOS devices.
