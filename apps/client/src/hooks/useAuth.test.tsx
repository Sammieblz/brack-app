import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  clearVerifiedUser: vi.fn(),
  getSession: vi.fn(),
  onChange: vi.fn(),
  signOut: vi.fn(),
  isNative: vi.fn(() => false),
  unregister: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  clearVerifiedAuthUserCache: mocks.clearVerifiedUser,
  getAuthSession: mocks.getSession,
  onAuthStateChange: mocks.onChange,
  signOut: mocks.signOut,
}));

vi.mock("@/services/pushNotifications", () => ({
  pushNotificationsService: {
    isNative: mocks.isNative,
    unregister: mocks.unregister,
  },
}));

import { useAuth } from "./useAuth";

const AuthProbe = ({ label }: { label: string }) => {
  const { loading, signOut, user } = useAuth();
  return (
    <div>
      {label}:{loading ? "loading" : user?.id ?? "signed-out"}
      <button type="button" onClick={() => void signOut()}>
        Sign out {label}
      </button>
    </div>
  );
};

describe("useAuth shared store", () => {
  it("restores and observes Auth once for every mounted consumer", async () => {
    let emit: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;
    mocks.getSession.mockResolvedValue(null);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.unregister.mockResolvedValue(undefined);
    mocks.onChange.mockImplementation((
      handler: (event: AuthChangeEvent, session: Session | null) => void,
    ) => {
      emit = handler;
      return { unsubscribe: vi.fn() };
    });

    render(
      <>
        <AuthProbe label="first" />
        <AuthProbe label="second" />
      </>,
    );

    await screen.findByText("first:signed-out");
    expect(screen.getByText("second:signed-out")).toBeInTheDocument();
    expect(mocks.getSession).toHaveBeenCalledOnce();
    expect(mocks.onChange).toHaveBeenCalledOnce();

    emit?.("SIGNED_IN", {
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "reader-1" },
    } as Session);

    await waitFor(() => {
      expect(screen.getByText("first:reader-1")).toBeInTheDocument();
      expect(screen.getByText("second:reader-1")).toBeInTheDocument();
    });

    mocks.isNative.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Sign out first" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(mocks.unregister).toHaveBeenCalledOnce();
    expect(mocks.unregister.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0],
    );
  });
});
