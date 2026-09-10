import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resetWidgetMock, runtime } = vi.hoisted(() => ({
  resetWidgetMock: vi.fn(),
  runtime: { customScheme: false },
}));

vi.mock("@marsidev/react-turnstile", async () => {
  const React = await import("react");
  const Turnstile = React.forwardRef<
    { reset: () => void },
    {
      onSuccess?: (token: string) => void;
      onExpire?: () => void;
      onError?: (errorCode?: string) => void;
      options?: { action?: string; size?: string; theme?: string };
    }
  >(({ onSuccess, onExpire, onError, options }, ref) => {
    React.useImperativeHandle(ref, () => ({ reset: resetWidgetMock }));
    return (
      <div
        data-testid="cloudflare-widget"
        data-action={options?.action}
        data-size={options?.size}
        data-theme={options?.theme}
      >
        <button type="button" onClick={() => onSuccess?.("challenge-token")}>
          Solve
        </button>
        <button type="button" onClick={() => onExpire?.()}>
          Expire
        </button>
        <button type="button" onClick={() => onError?.()}>
          Fail
        </button>
        <button type="button" onClick={() => onError?.("110200")}>
          Fail hostname
        </button>
      </div>
    );
  });
  Turnstile.displayName = "MockTurnstile";
  return { Turnstile };
});

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("@/services/platform", () => ({
  isCustomSchemeAuthRuntime: () => runtime.customScheme,
}));

import { AuthTurnstile, type AuthTurnstileHandle } from "./AuthTurnstile";
import {
  TURNSTILE_BRIDGE_EVENT,
  TURNSTILE_BRIDGE_INIT,
  type TurnstileBridgeInitMessage,
} from "@/utils/turnstile";

describe("AuthTurnstile", () => {
  beforeEach(() => {
    resetWidgetMock.mockReset();
    runtime.customScheme = false;
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
    vi.stubEnv("VITE_TURNSTILE_BRIDGE_ORIGIN", "https://staging.brack-app.com");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses a compact, theme-aware widget and clears expired tokens", () => {
    const onTokenChange = vi.fn();
    render(<AuthTurnstile action="sign_in" onTokenChange={onTokenChange} />);

    expect(screen.getByTestId("cloudflare-widget")).toHaveAttribute(
      "data-action",
      "sign_in"
    );
    expect(screen.getByTestId("cloudflare-widget")).toHaveAttribute(
      "data-size",
      "compact"
    );
    expect(screen.getByTestId("cloudflare-widget")).toHaveAttribute(
      "data-theme",
      "dark"
    );

    fireEvent.click(screen.getByRole("button", { name: "Solve" }));
    expect(onTokenChange).toHaveBeenLastCalledWith("challenge-token");
    expect(screen.getByText("Security check ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expire" }));
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByText("Refreshing the security check…")
    ).toBeInTheDocument();
  });

  it("resets the single-use widget through its imperative handle", () => {
    const ref = createRef<AuthTurnstileHandle>();
    const onTokenChange = vi.fn();
    render(
      <AuthTurnstile
        ref={ref}
        action="password_reset"
        onTokenChange={onTokenChange}
      />
    );

    act(() => {
      ref.current?.reset();
    });

    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(resetWidgetMock).toHaveBeenCalledOnce();
  });

  it("turns a silent hosted-bridge failure into a visible retry state", () => {
    vi.useFakeTimers();
    runtime.customScheme = true;
    const onTokenChange = vi.fn();

    render(<AuthTurnstile action="sign_up" onTokenChange={onTokenChange} />);

    const bridge = screen.getByTitle("Brack security check");
    expect(bridge).toBeInTheDocument();
    expect(bridge.parentElement).toHaveClass("max-h-0", "opacity-0");

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(
      screen.getByText(/Security check could not load/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
  });

  it("uses the configured live bridge origin for packaged runtimes", () => {
    runtime.customScheme = true;

    render(<AuthTurnstile action="sign_up" onTokenChange={vi.fn()} />);

    expect(screen.getByTitle("Brack security check")).toHaveAttribute(
      "src",
      "https://staging.brack-app.com/turnstile"
    );
  });

  it("handles a hosted iframe DOM error without treating it as an error code", () => {
    runtime.customScheme = true;
    const onTokenChange = vi.fn();

    render(<AuthTurnstile action="sign_up" onTokenChange={onTokenChange} />);

    const bridge = screen.getByTitle("Brack security check");
    // Simulate supplies the SyntheticEvent received by React's DOM callback.
    // Browsers may fail iframes silently; the timeout test covers that path.
    act(() => {
      Simulate.error(bridge);
    });

    expect(screen.getByText(/Security check could not load/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(bridge.parentElement).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByTitle("Brack security check")).not.toBe(bridge);
    expect(screen.getAllByTitle("Brack security check")).toHaveLength(1);
  });

  it("reveals one configured bridge only after its authenticated ready handshake", () => {
    vi.useFakeTimers();
    runtime.customScheme = true;
    const onTokenChange = vi.fn();

    render(<AuthTurnstile action="sign_up" onTokenChange={onTokenChange} />);

    const bridge = screen.getByTitle("Brack security check") as HTMLIFrameElement;
    const bridgeWindow = bridge.contentWindow!;
    const postMessage = vi.spyOn(bridgeWindow, "postMessage").mockImplementation(() => {});
    fireEvent.load(bridge);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TURNSTILE_BRIDGE_INIT,
        action: "sign_up",
        theme: "dark",
        channel: expect.any(String),
      }),
      "https://staging.brack-app.com"
    );
    const init = postMessage.mock.calls[0][0] as TurnstileBridgeInitMessage;
    const ready = {
      type: TURNSTILE_BRIDGE_EVENT,
      channel: init.channel,
      event: "ready",
    };

    for (const message of [
      { origin: "https://brack-app.com", source: bridgeWindow, data: ready },
      {
        origin: "https://staging.brack-app.com",
        source: bridgeWindow,
        data: { ...ready, channel: "another-channel-that-must-be-ignored" },
      },
      { origin: "https://staging.brack-app.com", source: window, data: ready },
    ]) {
      fireEvent(window, new MessageEvent("message", message));
      expect(bridge.parentElement).toHaveAttribute("aria-hidden", "true");
      expect(bridge.parentElement).toHaveClass("max-h-0", "opacity-0");
      expect(onTokenChange).not.toHaveBeenCalled();
    }

    fireEvent(window, new MessageEvent("message", {
      origin: "https://staging.brack-app.com",
      source: bridgeWindow,
      data: ready,
    }));

    expect(screen.getAllByTitle("Brack security check")).toHaveLength(1);
    expect(bridge).toHaveAttribute("src", "https://staging.brack-app.com/turnstile");
    expect(bridge.parentElement).not.toHaveAttribute("aria-hidden");
    expect(bridge.parentElement).toHaveClass("opacity-100");
    expect(bridge.parentElement).not.toHaveClass("max-h-0", "opacity-0");
    expect(bridge.parentElement).toHaveStyle({ maxHeight: "150px" });
    expect(onTokenChange).toHaveBeenLastCalledWith(null);

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("fails closed when a packaged build has no bridge origin", () => {
    runtime.customScheme = true;
    vi.stubEnv("VITE_TURNSTILE_BRIDGE_ORIGIN", "");

    render(<AuthTurnstile action="sign_up" onTokenChange={vi.fn()} />);

    expect(
      screen.getByText("Security check is unavailable in this build.")
    ).toBeInTheDocument();
    expect(screen.queryByTitle("Brack security check")).not.toBeInTheDocument();
  });

  it("explains a non-retryable hostname configuration failure", () => {
    render(<AuthTurnstile action="sign_up" onTokenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Fail hostname" }));

    expect(
      screen.getByText("Security check is not enabled for this address.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();
  });
});
