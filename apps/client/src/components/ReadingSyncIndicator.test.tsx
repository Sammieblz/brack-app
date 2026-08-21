import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1" } as { id: string } | null,
    loading: false,
  },
  getStatus: vi.fn(),
  syncCurrentUser: vi.fn(),
  useNetworkStatus: vi.fn(() => true),
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: mocks.useNetworkStatus,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/services/sync/engine", () => ({
  readingCoreSync: {
    getStatus: mocks.getStatus,
    syncCurrentUser: mocks.syncCurrentUser,
  },
  SYNC_STATUS_EVENT: "brack:sync-status-changed",
}));

vi.mock("@/components/SyncReviewDialog", () => ({
  SyncReviewDialog: () => null,
}));

import { ReadingSyncIndicator } from "./ReadingSyncIndicator";

const renderAt = (pathname: string) => render(
  <MemoryRouter initialEntries={[pathname]}>
    <ReadingSyncIndicator />
  </MemoryRouter>
);

describe("ReadingSyncIndicator", () => {
  beforeEach(() => {
    mocks.auth.user = { id: "user-1" };
    mocks.auth.loading = false;
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValue({
      userId: "user-1",
      pending: 0,
      failed: 1,
      syncing: 0,
    });
    mocks.syncCurrentUser.mockReset();
    mocks.useNetworkStatus.mockClear();
    mocks.toast.mockClear();
  });

  afterEach(cleanup);

  it.each([
    "/",
    "/auth",
    "/auth/callback",
    "/auth/reset-password/",
    "/onboarding",
    "/welcome",
    "/questionnaire",
    "/goals",
  ])("does not initialize reading sync on public route %s", async (pathname) => {
    renderAt(pathname);

    await waitFor(() => {
      expect(mocks.getStatus).not.toHaveBeenCalled();
      expect(mocks.useNetworkStatus).not.toHaveBeenCalled();
    });
    expect(screen.queryByText(/reading change needs review/i)).not.toBeInTheDocument();
  });

  it("does not initialize reading sync for a signed-out private route", async () => {
    mocks.auth.user = null;
    renderAt("/dashboard");

    await waitFor(() => {
      expect(mocks.getStatus).not.toHaveBeenCalled();
      expect(mocks.useNetworkStatus).not.toHaveBeenCalled();
    });
  });

  it("keeps the reading sync indicator active on authenticated private routes", async () => {
    renderAt("/dashboard");

    expect(await screen.findByText("1 reading change needs review")).toBeInTheDocument();
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
    expect(mocks.useNetworkStatus).toHaveBeenCalled();
  });
});
