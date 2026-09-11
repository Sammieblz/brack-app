import type { ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchReviewDetail: vi.fn(),
  fetchReviewComments: vi.fn(),
  addReviewComment: vi.fn(),
  getClubChatHistory: vi.fn(),
  sendClubChatMessage: vi.fn(),
  subscribeToClubChat: vi.fn(),
  setTyping: vi.fn(),
}));

// Every backend boundary is replaced; these tests never issue real reads or writes.
vi.mock("@/services/api", () => ({
  ...mocks,
  deleteBookReview: vi.fn(),
  deleteReviewComment: vi.fn(),
  shareReview: vi.fn(),
  toggleBookReviewLike: vi.fn(),
  deleteClubChatMessage: vi.fn(),
  markClubChatRead: vi.fn(),
  searchGifs: vi.fn(),
  toggleClubChatReaction: vi.fn(),
  uploadClubChatMediaFiles: vi.fn(),
}));
vi.mock("@/services/api/client", () => ({
  getApiErrorStatus: (error: { status?: number }) => error.status ?? null,
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ reviewId: "review" }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useNetworkStatus", () => ({ useNetworkStatus: () => true }));
vi.mock("@/contexts/ProfileContext", () => ({
  useProfileContext: () => ({ profile: { display_name: "Reader" } }),
}));
vi.mock("@/hooks/useClubChatTypingIndicator", () => ({
  useClubChatTypingIndicator: () => ({
    typingUsers: [],
    setTyping: mocks.setTyping,
  }),
}));
vi.mock("@/contexts/ConfirmDialogContext", () => ({
  useConfirmDialog: () => vi.fn(),
}));
vi.mock("@/components/MobileLayout", () => ({
  MobileLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: () => null }));
vi.mock("@/components/NativeHeader", () => ({ NativeHeader: () => null }));
vi.mock("@/components/social/ReviewCard", () => ({ ReviewCard: () => null }));
vi.mock("@/components/rich-text/RichTextRenderer", () => ({
  RichTextRenderer: ({ content }: { content: string }) => <p>{content}</p>,
}));
vi.mock("emoji-picker-react", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ReviewDetail from "@/screens/ReviewDetail";
import { ClubChatThread } from "@/components/clubs/ClubChatThread";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscribeToClubChat.mockReturnValue(vi.fn());
  mocks.fetchReviewDetail.mockResolvedValue({
    review: {
      id: "review",
      user_id: "author",
      book_id: "book",
      content: "A thoughtful review",
      rating: 4,
      created_at: "2026-09-01T12:00:00Z",
      comments_count: 0,
      likes_count: 0,
      book: { id: "book", title: "A Book", author: "An Author" },
      reviewer: { display_name: "Another Reader" },
    },
    related_reviews: [],
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("submission during independent thread loading", () => {
  it("preserves a review draft and prevents posting until the slow initial comments read completes", async () => {
    const comments = deferred<{
      comments: [];
      has_more: boolean;
      next_cursor: null;
    }>();
    mocks.fetchReviewComments.mockReturnValue(comments.promise);
    render(<ReviewDetail />);

    const composer = await screen.findByPlaceholderText(
      "Add a thoughtful reply...",
    );
    fireEvent.change(composer, { target: { value: "My preserved reply" } });
    const post = screen.getByRole("button", { name: "Post comment" });
    expect(post).toBeDisabled();
    fireEvent.click(post);
    expect(mocks.addReviewComment).not.toHaveBeenCalled();
    expect(composer).toHaveValue("My preserved reply");
    expect(screen.queryByText("No comments yet")).not.toBeInTheDocument();

    await act(async () =>
      comments.resolve({ comments: [], has_more: false, next_cursor: null }),
    );
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a thoughtful reply...")).toBe(
      composer,
    );
    expect(composer).toHaveValue("My preserved reply");
    expect(post).toBeEnabled();
    expect(mocks.addReviewComment).not.toHaveBeenCalled();
  });

  it("blocks Enter during initial club loading, then allows sending into a confirmed empty thread", async () => {
    const history = deferred<{ messages: [] }>();
    mocks.getClubChatHistory.mockReturnValue(history.promise);
    mocks.sendClubChatMessage.mockResolvedValue({
      id: "message",
      club_id: "club",
      user_id: "reader",
      content: "My club draft",
      created_at: "2026-09-01T12:00:00Z",
      message_type: "text",
      media: [],
    });
    render(
      <ClubChatThread clubId="club" currentUserId="reader" members={[]} />,
    );

    const composer = screen.getByPlaceholderText(
      "Message the club. Use @ to mention a member.",
    );
    fireEvent.change(composer, { target: { value: "My club draft" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    expect(mocks.sendClubChatMessage).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Send club message" }),
    ).toBeDisabled();
    expect(composer).toHaveValue("My club draft");

    await act(async () => history.resolve({ messages: [] }));
    expect(screen.getByText("No club messages yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send club message" }),
    ).toBeEnabled();
    expect(composer).toHaveValue("My club draft");
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    await waitFor(() =>
      expect(mocks.sendClubChatMessage).toHaveBeenCalledTimes(1),
    );
    expect(mocks.sendClubChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        club_id: "club",
        content: "My club draft",
      }),
    );
    await waitFor(() => expect(composer).toHaveValue(""));
    expect(screen.getByText("My club draft")).toBeInTheDocument();
  });

  it("preserves the club draft and blocks Enter after an initial history failure", async () => {
    const history = deferred<{ messages: [] }>();
    mocks.getClubChatHistory.mockReturnValue(history.promise);
    render(
      <ClubChatThread clubId="club" currentUserId="reader" members={[]} />,
    );
    const composer = screen.getByPlaceholderText(
      "Message the club. Use @ to mention a member.",
    );
    fireEvent.change(composer, { target: { value: "Keep this draft" } });

    await act(async () =>
      history.reject(Object.assign(new Error("Forbidden"), { status: 403 })),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Club chat could not update.",
    );
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    expect(mocks.sendClubChatMessage).not.toHaveBeenCalled();
    expect(composer).toHaveValue("Keep this draft");
    expect(
      screen.getByRole("button", { name: "Send club message" }),
    ).toBeDisabled();
    expect(screen.queryByText("No club messages yet")).not.toBeInTheDocument();
  });
});
