// Controlled native bridge signal; no native plugin or physical device claim.
const runtime = new URLSearchParams(window.location.search).get("runtime") ?? "web";
export const Capacitor = {
  isNativePlatform: () => ["ios", "android", "unknown"].includes(runtime),
  getPlatform: () => runtime,
};
