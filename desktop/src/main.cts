import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { DesktopLocalDb, type LocalDbRequest } from "./sqliteLocalDb.cjs";

const APP_SCHEME = "brack-app";
const DEEP_LINK_SCHEME = "brack";
const DEV_SERVER_URL = process.env.BRACK_ELECTRON_DEV_SERVER_URL;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let localDb: DesktopLocalDb | null = null;
let pendingAuthCallbackUrl: string | null = null;
let pendingDeepLinkUrl: string | null = null;

const isDev = () => Boolean(DEV_SERVER_URL);

const findDeepLinkArg = (argv: string[]) =>
  argv.find((arg) => arg.toLowerCase().startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null;

const isAuthRouteUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === `${DEEP_LINK_SCHEME}:` &&
      parsed.hostname.toLowerCase() === "auth" &&
      (parsed.pathname.startsWith("/callback") || parsed.pathname === "/reset-password")
    );
  } catch {
    return false;
  }
};

const sendToRenderer = (channel: "auth:callback" | "deep-link:open", url: string) => {
  if (!mainWindow || mainWindow.webContents.isLoading()) return false;
  mainWindow.webContents.send(channel, url);
  return true;
};

const dispatchDeepLinkUrl = (url: string) => {
  if (isAuthRouteUrl(url)) {
    if (!sendToRenderer("auth:callback", url)) {
      pendingAuthCallbackUrl = url;
    }
    return;
  }

  if (!sendToRenderer("deep-link:open", url)) {
    pendingDeepLinkUrl = url;
  }
};

const registerProtocolClient = () => {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
    return;
  }

  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
};

const rendererDistPath = () => path.join(app.getAppPath(), "dist");

const resolveWindowIconPath = () => {
  const candidates = [
    path.join(process.resourcesPath, "icon.png"),
    path.join(app.getAppPath(), "resources", "icon.png"),
    path.resolve("resources", "icon.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const isInside = (candidate: string, parent: string) => {
  const relative = path.relative(parent, candidate);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
};

const resolveRendererFile = (requestUrl: string) => {
  const root = rendererDistPath();
  const indexPath = path.join(root, "index.html");
  const parsed = new URL(requestUrl);
  const rawPath = decodeURIComponent(parsed.pathname || "/");
  const requestedPath = rawPath === "/" || !path.extname(rawPath) ? "/index.html" : rawPath;
  const normalizedPath = path.normalize(requestedPath).replace(/^([/\\])+/, "");
  const filePath = path.resolve(root, normalizedPath);

  if (!isInside(filePath, root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return indexPath;
  }

  return filePath;
};

const registerAppProtocol = () => {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveRendererFile(request.url);
    return net.fetch(pathToFileURL(filePath).toString());
  });
};

const isInternalNavigation = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === `${APP_SCHEME}:`) return true;
    if (!DEV_SERVER_URL) return false;
    return parsed.origin === new URL(DEV_SERVER_URL).origin;
  } catch {
    return false;
  }
};

const openExternalUrl = async (url: string) => {
  const parsed = new URL(url);

  if (parsed.protocol === `${DEEP_LINK_SCHEME}:`) {
    dispatchDeepLinkUrl(url);
    return;
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS external URLs can be opened from Brack desktop");
  }

  await shell.openExternal(url);
};

const assertTrustedSender = (event: IpcMainInvokeEvent) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Blocked IPC request from an untrusted renderer");
  }
};

const registerIpcHandlers = () => {
  ipcMain.handle("platform:get-info", (event) => {
    assertTrustedSender(event);
    return {
      runtime: "desktop",
      os: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
    };
  });

  ipcMain.handle("local-db:invoke", (event, request: LocalDbRequest) => {
    assertTrustedSender(event);
    if (!localDb) throw new Error("Desktop local database is not initialized");
    return localDb.handle(request);
  });

  ipcMain.handle("auth:open-external", async (event, url: string) => {
    assertTrustedSender(event);
    await openExternalUrl(url);
    return null;
  });

  ipcMain.handle("auth:get-pending-callback", (event) => {
    assertTrustedSender(event);
    const url = pendingAuthCallbackUrl;
    pendingAuthCallbackUrl = null;
    return url;
  });

  ipcMain.handle("deep-link:get-pending", (event) => {
    assertTrustedSender(event);
    const url = pendingDeepLinkUrl;
    pendingDeepLinkUrl = null;
    return url;
  });
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: "#0b1021",
    title: "Brack",
    icon: resolveWindowIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("focus", () => {
    mainWindow?.webContents.send("app:foreground");
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isInternalNavigation(url)) return;

    event.preventDefault();
    openExternalUrl(url).catch((error) => {
      console.error("Blocked unsafe navigation:", error);
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url).catch((error) => {
      console.error("Blocked unsafe popup:", error);
    });
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev() && DEV_SERVER_URL) {
    await mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadURL(`${APP_SCHEME}://brack/`);
  }
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  registerProtocolClient();

  app.on("second-instance", (_event, argv) => {
    const deepLinkUrl = findDeepLinkArg(argv);
    if (deepLinkUrl) dispatchDeepLinkUrl(deepLinkUrl);

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    dispatchDeepLinkUrl(url);
  });

  app.whenReady().then(async () => {
    registerAppProtocol();
    localDb = new DesktopLocalDb(path.join(app.getPath("userData"), "brack_offline.sqlite"));
    localDb.init();
    registerIpcHandlers();
    await createWindow();

    const initialDeepLinkUrl = findDeepLinkArg(process.argv);
    if (initialDeepLinkUrl) dispatchDeepLinkUrl(initialDeepLinkUrl);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch((error) => console.error("Failed to create Brack window:", error));
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    localDb?.close();
  });
}
