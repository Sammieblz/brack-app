import { contextBridge, ipcRenderer } from "electron";

type Callback = (url: string) => void;
type VoidCallback = () => void;

const authCallbacks = new Set<Callback>();
const deepLinkCallbacks = new Set<Callback>();
const foregroundCallbacks = new Set<VoidCallback>();
const bufferedAuthCallbacks: string[] = [];
const bufferedDeepLinks: string[] = [];

const drainBuffered = (buffer: string[], handler: Callback) => {
  while (buffer.length > 0) {
    const value = buffer.shift();
    if (value) handler(value);
  }
};

ipcRenderer.on("auth:callback", (_event, url: string) => {
  if (authCallbacks.size === 0) {
    bufferedAuthCallbacks.push(url);
    return;
  }

  authCallbacks.forEach((handler) => handler(url));
});

ipcRenderer.on("deep-link:open", (_event, url: string) => {
  if (deepLinkCallbacks.size === 0) {
    bufferedDeepLinks.push(url);
    return;
  }

  deepLinkCallbacks.forEach((handler) => handler(url));
});

ipcRenderer.on("app:foreground", () => {
  foregroundCallbacks.forEach((handler) => handler());
});

contextBridge.exposeInMainWorld("brackDesktop", {
  platform: {
    getInfo: () => ipcRenderer.invoke("platform:get-info"),
  },
  localDb: {
    invoke: (request: unknown) => ipcRenderer.invoke("local-db:invoke", request),
  },
  auth: {
    openExternal: (url: string) => ipcRenderer.invoke("auth:open-external", url),
    onCallback: (handler: Callback) => {
      authCallbacks.add(handler);
      drainBuffered(bufferedAuthCallbacks, handler);
      ipcRenderer.invoke("auth:get-pending-callback").then((url: string | null) => {
        if (url) handler(url);
      });

      return () => {
        authCallbacks.delete(handler);
      };
    },
  },
  deepLinks: {
    onOpen: (handler: Callback) => {
      deepLinkCallbacks.add(handler);
      drainBuffered(bufferedDeepLinks, handler);
      ipcRenderer.invoke("deep-link:get-pending").then((url: string | null) => {
        if (url) handler(url);
      });

      return () => {
        deepLinkCallbacks.delete(handler);
      };
    },
  },
  app: {
    onForeground: (handler: VoidCallback) => {
      foregroundCallbacks.add(handler);
      return () => {
        foregroundCallbacks.delete(handler);
      };
    },
  },
});
