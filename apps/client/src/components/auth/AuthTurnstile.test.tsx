import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
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

describe("AuthTurnstile", () => {
  beforeEach(() => {
    resetWidgetMock.mockReset();
    runtime.customScheme = false;
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
    vi.stubEnv("VITE_TURNSTILE_BRIDGE_ORIGIN", "https://staging.brack-app.com");
  });

  afterEach(() => {
    vi.useRealTimers();
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

    expect(screen.getByTitle("Brack security check")).toBeInTheDocument();

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
