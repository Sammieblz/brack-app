import {
  TURNSTILE_BRIDGE_EVENT,
  TURNSTILE_BRIDGE_INIT,
  getTurnstileSiteKey,
  isTurnstileAction,
  isValidTurnstileToken,
  type TurnstileBridgeEventMessage,
  type TurnstileBridgeInitMessage,
  type TurnstileTheme,
} from "@/utils/turnstile";

const ALLOWED_PARENT_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
  "brack-app://brack",
]);
const SCRIPT_SOURCE =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const root = document.getElementById("turnstile-root");
const siteKey = getTurnstileSiteKey();

let parentOrigin: string | null = null;
let channel: string | null = null;
let action: TurnstileBridgeInitMessage["action"] | null = null;
let theme: TurnstileTheme = "light";
let widgetId: string | null = null;
let widgetSize: "compact" | "flexible" | null = null;
let initialized = false;

const postBridgeEvent = (
  event: TurnstileBridgeEventMessage["event"],
  extra: Pick<TurnstileBridgeEventMessage, "token" | "height"> = {},
) => {
  if (!parentOrigin || !channel) return;

  window.parent.postMessage(
    {
      type: TURNSTILE_BRIDGE_EVENT,
      channel,
      event,
      ...extra,
    } satisfies TurnstileBridgeEventMessage,
    parentOrigin,
  );
};

const resolveSize = () =>
  document.documentElement.clientWidth >= 300 ? "flexible" : "compact";

const publishLayout = (size: "compact" | "flexible") => {
  postBridgeEvent("layout", { height: size === "compact" ? 145 : 70 });
};

const renderWidget = () => {
  if (!root || !siteKey || !action || !window.turnstile) {
    postBridgeEvent("error");
    return;
  }

  const nextSize = resolveSize();
  if (widgetId) window.turnstile.remove(widgetId);
  root.replaceChildren();
  widgetSize = nextSize;
  publishLayout(nextSize);
  postBridgeEvent("ready");

  const renderedId = window.turnstile.render(root, {
    sitekey: siteKey,
    action,
    theme,
    size: nextSize,
    appearance: "interaction-only",
    execution: "render",
    retry: "auto",
    "refresh-expired": "auto",
    "refresh-timeout": "auto",
    callback: (token) => {
      if (!isValidTurnstileToken(token)) {
        postBridgeEvent("error");
        return;
      }
      postBridgeEvent("token", { token });
    },
    "expired-callback": () => postBridgeEvent("expired"),
    "timeout-callback": () => postBridgeEvent("timeout"),
    "error-callback": () => postBridgeEvent("error"),
    "unsupported-callback": () => postBridgeEvent("error"),
  });

  widgetId = renderedId ?? null;
  if (!widgetId) postBridgeEvent("error");
};

const loadScript = () => {
  if (window.turnstile) {
    renderWidget();
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-brack-turnstile="true"]',
  );
  if (existing) return;

  const script = document.createElement("script");
  script.src = SCRIPT_SOURCE;
  script.async = true;
  script.defer = true;
  script.dataset.brackTurnstile = "true";
  script.addEventListener("load", renderWidget, { once: true });
  script.addEventListener("error", () => postBridgeEvent("error"), {
    once: true,
  });
  document.head.append(script);
};

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (
    initialized ||
    event.source !== window.parent ||
    !ALLOWED_PARENT_ORIGINS.has(event.origin) ||
    !event.data ||
    typeof event.data !== "object"
  ) {
    return;
  }

  const message = event.data as Partial<TurnstileBridgeInitMessage>;
  if (
    message.type !== TURNSTILE_BRIDGE_INIT ||
    typeof message.channel !== "string" ||
    message.channel.length < 16 ||
    message.channel.length > 128 ||
    !isTurnstileAction(message.action) ||
    (message.theme !== "light" && message.theme !== "dark")
  ) {
    return;
  }

  initialized = true;
  parentOrigin = event.origin;
  channel = message.channel;
  action = message.action;
  theme = message.theme;

  if (!root || !siteKey) {
    postBridgeEvent("error");
    return;
  }

  loadScript();
});

window.addEventListener("resize", () => {
  if (!initialized || !widgetSize || resolveSize() === widgetSize) return;
  renderWidget();
});
