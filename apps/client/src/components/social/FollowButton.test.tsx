import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowAction, type FollowActionRelationship } from "./FollowButton";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "current-reader" } }),
}));

const relationship = (
  overrides: Partial<FollowActionRelationship> = {}
): FollowActionRelationship => ({
  isFollowing: false,
  isFollowedBy: false,
  isMutual: false,
  loading: false,
  followUser: vi.fn().mockResolvedValue(undefined),
  unfollowUser: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("FollowAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers a follow-back action when the other reader follows first", () => {
    render(
      <FollowAction
        userId="other-reader"
        relationship={relationship({ isFollowedBy: true })}
      />
    );

    expect(screen.getByRole("button", { name: "Follow back" })).toBeInTheDocument();
  });

  it("keeps mutual unfollow compact and explains the messaging consequence", async () => {
    const user = userEvent.setup();
    const unfollowUser = vi.fn().mockResolvedValue(undefined);
    render(
      <FollowAction
        userId="other-reader"
        displayName="Avery"
        context="profile"
        relationship={relationship({
          isFollowing: true,
          isFollowedBy: true,
          isMutual: true,
          unfollowUser,
        })}
      />
    );

    expect(screen.getByRole("status", { name: "Following Avery" })).toBeInTheDocument();
    expect(screen.queryByText("Unfollow")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Relationship actions for Avery" }));
    await user.click(screen.getByRole("menuitem", { name: "Unfollow" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Your conversation history will stay available"
    );
    await user.click(screen.getByRole("button", { name: "Unfollow" }));
    expect(unfollowUser).toHaveBeenCalledTimes(1);
  });

  it("does not add a consequence confirmation to a one-way follow", async () => {
    const user = userEvent.setup();
    const unfollowUser = vi.fn().mockResolvedValue(undefined);
    render(
      <FollowAction
        userId="other-reader"
        displayName="Avery"
        context="profile"
        relationship={relationship({ isFollowing: true, unfollowUser })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Relationship actions for Avery" }));
    await user.click(screen.getByRole("menuitem", { name: "Unfollow" }));

    expect(unfollowUser).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
