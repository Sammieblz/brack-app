import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  AuthCallbackBootstrapErrorMock,
  completeAuthCallbackMock,
  publishAuthFlowCompletionMock,
} = vi.hoisted(() => {
    class AuthCallbackBootstrapErrorMock extends Error {
      readonly fallbackPath = "/dashboard";
    }

    return {
      AuthCallbackBootstrapErrorMock,
      completeAuthCallbackMock: vi.fn(),
      publishAuthFlowCompletionMock: vi.fn(),
    };
  });

vi.mock("@/services/authRedirect", () => ({
  AuthCallbackBootstrapError: AuthCallbackBootstrapErrorMock,
  completeAuthCallback: completeAuthCallbackMock,
}));

vi.mock("@/services/authFlowBridge", () => ({
  publishAuthFlowCompletion: publishAuthFlowCompletionMock,
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: ({ text }: { text?: string }) => <div>{text}</div>,
}));

vi.mock("@/components/ThemeAwareLogo", () => ({
  ThemeAwareLogo: () => <div aria-label="Brack" />,
}));

import AuthCallback from "./AuthCallback";

const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="location">{location.pathname}</output>;
};

const renderCallback = () =>
  render(
    <MemoryRouter initialEntries={["/auth/callback?code=test-code"]}>
      <AuthCallback />
      <LocationProbe />
    </MemoryRouter>,
  );

describe("AuthCallback", () => {
  beforeEach(() => {
    completeAuthCallbackMock.mockReset();
    publishAuthFlowCompletionMock.mockReset();
    publishAuthFlowCompletionMock.mockReturnValue(false);
    window.history.replaceState({}, "", "/auth/callback?code=test-code");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("signals and closes an OAuth callback popup instead of navigating it", async () => {
    completeAuthCallbackMock.mockResolvedValue("/dashboard");
    publishAuthFlowCompletionMock.mockReturnValue(true);
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);

    renderCallback();

    expect(
      await screen.findByText("Returning to your sign-up..."),
    ).toBeInTheDocument();
    expect(publishAuthFlowCompletionMock).toHaveBeenCalledOnce();
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("location")).toHaveTextContent(
      "/auth/callback",
    );
    expect(window.location.search).toBe("");
  });

  it("navigates a standalone callback when no requesting window exists", async () => {
    completeAuthCallbackMock.mockResolvedValue("/dashboard");

    renderCallback();

    await waitFor(() => {
      expect(screen.getByLabelText("location")).toHaveTextContent("/dashboard");
    });
    expect(publishAuthFlowCompletionMock).toHaveBeenCalled();
  });

  it("uses the safe authenticated fallback after profile bootstrap fails", async () => {
    completeAuthCallbackMock.mockRejectedValue(
      new AuthCallbackBootstrapErrorMock("profile unavailable"),
    );

    renderCallback();

    await waitFor(() => {
      expect(screen.getByLabelText("location")).toHaveTextContent("/dashboard");
    });
    expect(
      screen.queryByRole("heading", { name: "Sign-in link unavailable" }),
    ).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("shows an invalid-link state and removes callback credentials", async () => {
    completeAuthCallbackMock.mockRejectedValue(new Error("expired callback"));

    renderCallback();

    expect(
      await screen.findByRole("heading", { name: "Sign-in link unavailable" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth/callback");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });
});
