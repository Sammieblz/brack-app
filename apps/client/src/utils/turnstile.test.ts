import { describe, expect, it } from "vitest";

import {
  TURNSTILE_BRIDGE_EVENT,
  TURNSTILE_MAX_TOKEN_LENGTH,
  isTurnstileAction,
  isTurnstileBridgeEvent,
  isValidTurnstileToken,
  normalizeTurnstileBridgeOrigin,
  shouldUseHostedTurnstileBridge,
} from "./turnstile";

describe("Turnstile request boundaries", () => {
  it("accepts only the enumerated Auth actions", () => {
    expect(isTurnstileAction("sign_up")).toBe(true);
    expect(isTurnstileAction("change_password")).toBe(true);
    expect(isTurnstileAction("admin_override")).toBe(false);
    expect(isTurnstileAction(1)).toBe(false);
  });

  it("rejects empty, padded, and oversized tokens", () => {
    expect(isValidTurnstileToken("challenge-token")).toBe(true);
    expect(isValidTurnstileToken("")).toBe(false);
    expect(isValidTurnstileToken(" padded-token ")).toBe(false);
    expect(
      isValidTurnstileToken("x".repeat(TURNSTILE_MAX_TOKEN_LENGTH + 1))
    ).toBe(false);
  });

  it("validates bridge messages before accepting a cross-origin token", () => {
    const channel = "a".repeat(48);

    expect(
      isTurnstileBridgeEvent({
        type: TURNSTILE_BRIDGE_EVENT,
        channel,
        event: "token",
        token: "challenge-token",
      })
    ).toBe(true);
    expect(
      isTurnstileBridgeEvent({
        type: TURNSTILE_BRIDGE_EVENT,
        channel,
        event: "token",
        token: "",
      })
    ).toBe(false);
    expect(
      isTurnstileBridgeEvent({
        type: TURNSTILE_BRIDGE_EVENT,
        channel,
        event: "layout",
        height: 10_000,
      })
    ).toBe(false);
  });

  it("uses the canonical HTTPS bridge for packaged app origins", () => {
    expect(
      shouldUseHostedTurnstileBridge({
        customSchemeRuntime: false,
      })
    ).toBe(false);
    expect(
      shouldUseHostedTurnstileBridge({
        customSchemeRuntime: true,
      })
    ).toBe(true);
  });

  it("renders directly for browser development origins", () => {
    expect(
      shouldUseHostedTurnstileBridge({
        customSchemeRuntime: false,
      })
    ).toBe(false);
  });

  it("accepts only an exact HTTPS origin for the packaged-app bridge", () => {
    expect(
      normalizeTurnstileBridgeOrigin("https://staging.brack-app.com")
    ).toBe("https://staging.brack-app.com");
    expect(
      normalizeTurnstileBridgeOrigin("https://staging.brack-app.com/")
    ).toBe("https://staging.brack-app.com");
    expect(normalizeTurnstileBridgeOrigin("http://localhost:8080")).toBeNull();
    expect(
      normalizeTurnstileBridgeOrigin("https://staging.brack-app.com/turnstile")
    ).toBeNull();
    expect(
      normalizeTurnstileBridgeOrigin("https://user@example.com")
    ).toBeNull();
  });
});
