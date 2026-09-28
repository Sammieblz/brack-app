import { App } from "@capacitor/app";
import { getRuntimePlatform } from "@/services/platform";

/** App's Android event only; subscribing to its DOM event as well would double-handle Back. */
export function subscribeNativeBack(onBack: () => void): () => void {
  if (getRuntimePlatform() !== "android") return () => undefined;
  let disposed = false;
  let remove: (() => Promise<void>) | undefined;
  const removeListener = (removeHandle: () => Promise<void>) => {
    void Promise.resolve().then(removeHandle)
      .catch((error: unknown) => console.error("Could not remove native Back listener", error));
  };
  void Promise.resolve().then(() => App.addListener("backButton", () => { if (!disposed) onBack(); }))
    .then((handle) => {
      if (disposed) removeListener(() => handle.remove());
      else remove = () => handle.remove();
    })
    .catch((error: unknown) => console.error("Could not register native Back", error));
  return () => {
    if (disposed) return;
    disposed = true;
    if (remove) { removeListener(remove); remove = undefined; }
  };
}

/** Android root Back backgrounds the app; it does not terminate the reading session. */
export function minimizeNativeApp(): void {
  if (getRuntimePlatform() === "android") {
    void App.minimizeApp().catch((error: unknown) => console.error("Could not background the app", error));
  }
}
