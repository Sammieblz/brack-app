import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  AuthCallbackBootstrapErrorMock,
  closeExternalAuthSessionMock,
  completeAuthCallbackMock,
  deepLinkInitializeMock,
  onDesktopAuthCallbackMock,
} = vi.hoisted(() => {
  class AuthCallbackBootstrapErrorMock extends Error {
    readonly fallbackPath = "/dashboard";
  }

  return {
    AuthCallbackBootstrapErrorMock,
    closeExternalAuthSessionMock: vi.fn(),
    completeAuthCallbackMock: vi.fn(),
    deepLinkInitializeMock: vi.fn(),
    onDesktopAuthCallbackMock: vi.fn(),
  };
});

vi.mock("@/services/authRedirect", () => ({
  AuthCallbackBootstrapError: AuthCallbackBootstrapErrorMock,
  completeAuthCallback: completeAuthCallbackMock,
}));

vi.mock("@/services/deepLinkService", () => ({
  deepLinkService: { initialize: deepLinkInitializeMock },
}));

vi.mock("@/services/platform", () => ({
  closeExternalAuthSession: closeExternalAuthSessionMock,
  onDesktopAuthCallback: onDesktopAuthCallbackMock,
}));

import { DeepLinkHandler } from "./DeepLinkHandler";

const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="location">{`${location.pathname}${location.search}`}</output>;
};

const renderHandler = () =>
  render(
    <MemoryRouter initialEntries={["/auth"]}>
      <DeepLinkHandler />
      <LocationProbe />
    </MemoryRouter>,
  );

describe("DeepLinkHandler auth callbacks", () => {
  let desktopCallback: ((url: string) => void | Promise<void>) | undefined;
  let nativeCallback: ((url: string) => void | Promise<void>) | undefined;

  beforeEach(() => {
    desktopCallback = undefined;
    nativeCallback = undefined;
    closeExternalAuthSessionMock.mockReset();
    closeExternalAuthSessionMock.mockResolvedValue(undefined);
    completeAuthCallbackMock.mockReset();
    deepLinkInitializeMock.mockReset();
    deepLinkInitializeMock.mockImplementation(
      async (
        _navigate: unknown,
        options: { onAuthCallback?: (url: string) => void | Promise<void> },
      ) => {
        nativeCallback = options.onAuthCallback;
        return vi.fn();
      },
    );
    onDesktopAuthCallbackMock.mockReset();
    onDesktopAuthCallbackMock.mockImplementation(
      (callback: (url: string) => void | Promise<void>) => {
        desktopCallback = callback;
        return vi.fn();
      },
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the authenticated fallback for a desktop bootstrap failure", async () => {
    completeAuthCallbackMock.mockRejectedValue(
      new AuthCallbackBootstrapErrorMock("profile unavailable"),
    );
    renderHandler();
    await waitFor(() => expect(desktopCallback).toBeTypeOf("function"));

    await act(async () => {
      await desktopCallback?.("brack://auth/callback?code=desktop-code");
    });

    expect(screen.getByLabelText("location")).toHaveTextContent("/dashboard");
    expect(closeExternalAuthSessionMock).not.toHaveBeenCalled();
  });

  it("routes a failed native callback to auth and closes the external browser", async () => {
    completeAuthCallbackMock.mockRejectedValue(new Error("expired callback"));
    renderHandler();
    await waitFor(() => expect(nativeCallback).toBeTypeOf("function"));

    await act(async () => {
      await nativeCallback?.("brack://auth/callback?code=native-code");
    });

    expect(screen.getByLabelText("location")).toHaveTextContent(
      "/auth?auth_error=callback",
    );
    expect(closeExternalAuthSessionMock).toHaveBeenCalledOnce();
  });
});
