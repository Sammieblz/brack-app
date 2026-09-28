import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { User } from "@/types";

const mocks = vi.hoisted(() => ({
  fetchProfile: vi.fn(), upsertProfileBasics: vi.fn(), uploadClubImageFile: vi.fn(), toast: vi.fn(),
  user: { id: "reader", email: "reader@example.test", user_metadata: {} },
}));
vi.mock("@/services/api", () => ({
  fetchProfile: mocks.fetchProfile, upsertProfileBasics: mocks.upsertProfileBasics,
  removeStorageFiles: vi.fn(), updateProfileAvatar: vi.fn(), uploadPublicStorageFile: vi.fn(),
}));
vi.mock("@/services/api/clubs", () => ({ uploadClubImageFile: mocks.uploadClubImageFile }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock("@/hooks/useFollowing", () => ({ useFollowing: () => ({ followersCount: 0, followingCount: 0 }) }));
vi.mock("@/hooks/useImagePicker", () => ({ useImagePicker: () => ({ pickWithPrompt: vi.fn() }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/ImagePickerDialog", () => ({ ImagePickerDialog: () => null }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: () => null }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => children }));

import { CreateClubDialog } from "./clubs/CreateClubDialog";
import { ProfileSettings } from "./settings/ProfileSettings";
import ProfilePage from "@/screens/Profile";
import { ReviewComments } from "./social/ReviewComments";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchProfile.mockResolvedValue({ user_id: "reader", display_name: "Reader", bio: "My books" });
  mocks.upsertProfileBasics.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("profile, clubs and review form accessibility", () => {
  for (const variant of ["settings", "page"]) {
    it(`associates ${variant} profile labels, descriptions and save failure without losing edits`, async () => {
      mocks.upsertProfileBasics.mockRejectedValueOnce(new Error("Profile update unavailable"));
      render(<MemoryRouter>{variant === "settings"
        ? <ProfileSettings user={mocks.user as User} /> : <ProfilePage />}</MemoryRouter>);
      const name = await screen.findByRole("textbox", { name: "Display Name" });
      expect(name).toHaveAccessibleDescription("This is how your name appears to other users");
      expect(screen.getByRole("textbox", { name: "Bio" })).toHaveAccessibleDescription("Tell others about yourself and your reading interests");
      fireEvent.change(name, { target: { value: "My changed name" } });
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Profile update unavailable");
      expect(name).toHaveValue("My changed name");
      expect(name).not.toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("button", { name: "Save Changes" })).toHaveAccessibleDescription("Profile update unavailable");
    });
  }

  it("names club controls and describes privacy and creation errors at their controls", async () => {
    const onCreateClub = vi.fn().mockRejectedValueOnce(new Error("Club could not be created"));
    render(<CreateClubDialog onCreateClub={onCreateClub} />);
    fireEvent.click(screen.getByRole("button", { name: "Create club" }));
    const name = screen.getByRole("textbox", { name: "Club Name *" });
    for (const label of ["Description", "Genres", "Tags", "City", "Country"]) {
      expect(screen.getByRole("textbox", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("spinbutton", { name: "Member limit" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Private Club" })).toHaveAccessibleDescription(/discussions and members stay private/);
    fireEvent.change(name, { target: { value: "My reading club" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Club" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Club could not be created");
    expect(name).toHaveValue("My reading club");
    expect(screen.getByRole("button", { name: "Create Club" })).toHaveAccessibleDescription("Club could not be created");
  });

  it("keeps a failed review comment editable and associates its retry feedback", async () => {
    const add = vi.fn().mockRejectedValueOnce(new Error("Comment could not be posted")).mockResolvedValue(undefined);
    render(<MemoryRouter><ReviewComments reviewId="review" comments={[]} onAddComment={add} onDeleteComment={vi.fn()} /></MemoryRouter>);
    const comment = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(comment, { target: { value: "Keep this comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Comment could not be posted");
    expect(comment).toHaveValue("Keep this comment");
    expect(comment).toHaveAccessibleDescription("Comment could not be posted");
    fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));
    await waitFor(() => expect(comment).toHaveValue(""));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
