import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadOnboardingDraftMock,
  resolvePostAuthPathMock,
  useAuthMock,
} = vi.hoisted(() => ({
  loadOnboardingDraftMock: vi.fn(),
  resolvePostAuthPathMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/services/authRedirect", () => ({
  resolvePostAuthPath: resolvePostAuthPathMock,
}));

vi.mock("@/services/onboardingDraft", () => ({
  loadOnboardingDraft: loadOnboardingDraftMock,
}));

import { OnboardingRouteGuard } from "./OnboardingRouteGuard";

describe("OnboardingRouteGuard", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({
      user: { id: "reader-1" },
      loading: false,
    });
    loadOnboardingDraftMock.mockReset();
    resolvePostAuthPathMock.mockReset();
    resolvePostAuthPathMock.mockResolvedValue("/onboarding");
  });

  it("does not automatically replay a failed draft handoff", async () => {
    loadOnboardingDraftMock.mockReturnValue({ stage: "auth_started" });

    render(
      <MemoryRouter initialEntries={["/onboarding?resume=draft"]}>
        <OnboardingRouteGuard />
      </MemoryRouter>,
    );
    await act(async () => Promise.resolve());

    expect(loadOnboardingDraftMock).toHaveBeenCalledOnce();
    expect(resolvePostAuthPathMock).not.toHaveBeenCalled();
  });

  it("does not trust the recovery query without an active in-memory draft", async () => {
    loadOnboardingDraftMock.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={["/onboarding?resume=draft"]}>
        <OnboardingRouteGuard />
      </MemoryRouter>,
    );
    await act(async () => Promise.resolve());

    expect(resolvePostAuthPathMock).toHaveBeenCalledOnce();
  });
});
