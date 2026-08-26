export const TURNSTILE_MAX_TOKEN_LENGTH = 2_048;

export const TURNSTILE_ACTIONS = [
  "sign_up",
  "sign_in",
  "password_reset",
  "resend_sign_up",
  "resend_recovery",
  "change_password",
] as const;

export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[number];
export type TurnstileTheme = "light" | "dark";

export const TURNSTILE_BRIDGE_PATH = "/turnstile.html";
export const TURNSTILE_BRIDGE_INIT = "brack:turnstile:init";
export const TURNSTILE_BRIDGE_EVENT = "brack:turnstile:event";

export type TurnstileBridgeInitMessage = {
  type: typeof TURNSTILE_BRIDGE_INIT;
  channel: string;
  action: TurnstileAction;
  theme: TurnstileTheme;
};

export type TurnstileBridgeEventMessage = {
  type: typeof TURNSTILE_BRIDGE_EVENT;
  channel: string;
  event: "ready" | "token" | "expired" | "timeout" | "error" | "layout";
  token?: string;
  height?: number;
};

export const isTurnstileAction = (value: unknown): value is TurnstileAction =>
  typeof value === "string" &&
  (TURNSTILE_ACTIONS as readonly string[]).includes(value);

export const isValidTurnstileToken = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= TURNSTILE_MAX_TOKEN_LENGTH &&
  value.trim() === value;

export const getTurnstileSiteKey = (): string | null => {
  const value = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 128
    ? normalized
    : null;
};

export const shouldUseHostedTurnstileBridge = ({
  customSchemeRuntime,
  protocol,
  development,
}: {
  customSchemeRuntime: boolean;
  protocol: string;
  development: boolean;
}) =>
  customSchemeRuntime &&
  !(
    development &&
    (protocol === "http:" || protocol === "https:")
  );

export const isTurnstileBridgeEvent = (
  value: unknown,
): value is TurnstileBridgeEventMessage => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<TurnstileBridgeEventMessage>;
  if (
    candidate.type !== TURNSTILE_BRIDGE_EVENT ||
    typeof candidate.channel !== "string" ||
    candidate.channel.length < 16 ||
    candidate.channel.length > 128 ||
    ![
      "ready",
      "token",
      "expired",
      "timeout",
      "error",
      "layout",
    ].includes(candidate.event ?? "")
  ) {
    return false;
  }

  if (candidate.event === "token") {
    return isValidTurnstileToken(candidate.token);
  }

  if (candidate.event === "layout") {
    return (
      typeof candidate.height === "number" &&
      Number.isFinite(candidate.height) &&
      candidate.height >= 65 &&
      candidate.height <= 160
    );
  }

  return candidate.token === undefined && candidate.height === undefined;
};
