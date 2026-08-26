import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resetWidgetMock } = vi.hoisted(() => ({
  resetWidgetMock: vi.fn(),
}));

vi.mock("@marsidev/react-turnstile", async () => {
  const React = await import("react");
  const Turnstile = React.forwardRef<
    { reset: () => void },
    {
      onSuccess?: (token: string) => void;
      onExpire?: () => void;
      onError?: () => void;
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
  BRACK_WEB_ORIGIN: "https://brack-app.com",
  isCustomSchemeAuthRuntime: () => false,
}));

import {
  AuthTurnstile,
  type AuthTurnstileHandle,
} from "./AuthTurnstile";

describe("AuthTurnstile", () => {
  beforeEach(() => {
    resetWidgetMock.mockReset();
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
  });

  it("uses a compact, theme-aware widget and clears expired tokens", () => {
    const onTokenChange = vi.fn();
    render(
      <AuthTurnstile action="sign_in" onTokenChange={onTokenChange} />,
    );

    expect(screen.getByTestId("cloudflare-widget")).toHaveAttribute(
      "data-action",
      "sign_in",
    );
    expect(screen.getByTestId("cloudflare-widget")).toHaveAttribute(
      "data-size",
      "compact",
    );
    expect(screen.getByTestId("cloudflare-widget")).toHaveAttribute(
      "data-theme",
      "dark",
    );

    fireEvent.click(screen.getByRole("button", { name: "Solve" }));
    expect(onTokenChange).toHaveBeenLastCalledWith("challenge-token");
    expect(screen.getByText("Security check ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expire" }));
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByText("Refreshing the security check…"),
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
      />,
    );

    ref.current?.reset();

    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(resetWidgetMock).toHaveBeenCalledOnce();
  });
});
