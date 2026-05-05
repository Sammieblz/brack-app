# Mobile and Device Boundaries

Source date: 2026-05-05  
Scope: ticket 8.2, isolate Capacitor/device-specific behavior.

## Current Boundary Map

| Capability | Current owner | Web fallback |
| --- | --- | --- |
| Barcode scanning | `src/hooks/useBarcodeScanner.ts` | Camera/photo prompt plus canvas barcode detection path. |
| Cover OCR | `src/hooks/useCoverScanner.ts`, `src/utils/ocrHelpers.ts` | Photo picker/OCR in browser. |
| Generic image picking | `src/hooks/useImagePicker.ts` | File input fallback. |
| Push registration | `src/services/pushNotifications.ts`, `src/hooks/usePushNotifications.ts` | No-op with clear unsupported state. |
| Push send API | `src/services/api/notifications.ts` and `send-push-notification` Edge Function | Server-side send only. |
| Badge push orchestration | `src/services/badgeNotifications.ts` | No-op on web. |
| Image cache/filesystem | `src/services/imageCache.ts` | Browser cache/data URL path. |
| Offline DB | `src/services/local/driver.ts` | Dexie on web, SQLite on native. |
| App lifecycle sync | `src/services/syncService.ts` | Browser `visibilitychange`; native Capacitor App plugin. |
| Haptics | `src/hooks/useHapticFeedback.ts` | No-op on web. |
| Sharing | `src/services/shareService.ts` | Web Share API / clipboard fallback. |
| Timer notifications and app-state bridge | `src/services/timerNative.ts`, used by `src/contexts/TimerContext.tsx` | Native local notifications only; web is a no-op. |

## Boundary Rule

- Domain services should not depend on Capacitor.
- Device integrations should live in hooks or platform services.
- Components should call hooks/services, not raw Capacitor plugins.
- Native-only behavior must have an explicit web no-op or fallback.

## Current State

- `TimerContext` owns timer state and UI events; native app-state and Local Notification plugin calls live in `timerNativeService`.
- `useBadges` owns badge UI/toast behavior; native badge push dispatch lives in `badgeNotificationService`.
- `usePushNotifications` delegates platform detection and plugin calls to `pushNotificationsService`.
- Camera/OCR/barcode code is isolated in hooks with web fallbacks. If scanner behavior grows, move plugin-specific camera capture into a scanner service.

## Recommendation

Keep device calls out of screens and domain API modules. For the next native QA pass, focus on testing timer notifications and camera/scanner permissions on Android and iOS rather than adding more abstractions.
