import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "reader-1" },
  posts: { posts: [], loading: true, hasLoaded: false, error: null, loadingMore: false, hasMore: false, caughtUp: false, feedMode: "following", refetchPosts: vi.fn(), loadMore: vi.fn(), toggleLike: vi.fn() } as Record<string, unknown>,
  activity: { activities: [], loading: true, hasLoaded: false, error: null, refetchFeed: vi.fn(), formatTimeAgo: vi.fn() } as Record<string, unknown>,
  inbox: { conversations: [], loading: true, hasLoaded: false, error: null, getOrCreateConversation: vi.fn(), refetchConversations: vi.fn() } as Record<string, unknown>,
  thread: { messages: [], detail: null, loading: true, hasLoaded: false, error: null, sendMessage: vi.fn(), toggleReaction: vi.fn(), deleteMessage: vi.fn(), refetchMessages: vi.fn() } as Record<string, unknown>,
}));

vi.mock("@/hooks/usePosts", () => ({ usePosts: () => mocks.posts }));
vi.mock("@/hooks/useSocialFeed", () => ({ useSocialFeed: () => mocks.activity }));
vi.mock("@/hooks/useConversations", () => ({ useConversations: () => mocks.inbox }));
vi.mock("@/hooks/useMessages", () => ({ useMessages: () => mocks.thread }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/NativeHeader", () => ({ NativeHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: () => null }));
vi.mock("@/components/PullToRefresh", () => ({ PullToRefresh: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/social/CreatePostDialog", () => ({ CreatePostDialog: () => null }));
vi.mock("@/components/social/PostCard", () => ({ PostCard: () => <article>Loaded post</article> }));
vi.mock("@/components/social/FeedItem", () => ({ FeedItem: () => <article>Loaded activity</article> }));
vi.mock("@/components/messaging/ConversationsList", () => ({ ConversationsList: ({ onSelectConversation }: { onSelectConversation: (id: string) => void }) => <div>Loaded inbox<button onClick={() => onSelectConversation("thread-1")}>Open thread</button></div> }));
vi.mock("@/components/messaging/MessageThread", () => ({ MessageThread: () => <input aria-label="Message draft" defaultValue="Keep my draft" /> }));
vi.mock("@/components/empty/PremiumEmptyState", () => ({ PremiumEmptyState: ({ title }: { title: string }) => <p>{title}</p> }));
vi.mock("@/components/empty/EmptyActivity", () => ({ EmptyActivity: () => <p>No activity yet</p> }));

import Feed from "./Feed";
import Messages from "./Messages";
import { ActivityFeed } from "@/components/social/ActivityFeed";

describe("social loading contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "reader-1" };
    Object.assign(mocks.posts, { posts: [], loading: true, hasLoaded: false, error: null });
    Object.assign(mocks.activity, { activities: [], loading: true, hasLoaded: false, error: null });
    Object.assign(mocks.inbox, { conversations: [], loading: true, hasLoaded: false, error: null });
    Object.assign(mocks.thread, { messages: [], detail: null, loading: true, hasLoaded: false, error: null });
  });

  it("keeps feed chrome and two inert initial-viewport post cards", () => {
    const { container } = render(<MemoryRouter><Feed /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Activity Feed" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-skeleton="post"]')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Loading posts"]')).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector('[data-skeleton="post"] button')).toBeNull();
    expect(screen.queryByText("No posts yet")).not.toBeInTheDocument();
  });

  it("keeps posts and a loaded empty feed during refresh", () => {
    Object.assign(mocks.posts, { posts: [{ id: "post-1" }], loading: false, hasLoaded: true });
    const { container, rerender } = render(<MemoryRouter><Feed /></MemoryRouter>);
    const post = screen.getByText("Loaded post");
    mocks.posts.loading = true;
    rerender(<MemoryRouter><Feed /></MemoryRouter>);
    expect(screen.getByText("Loaded post")).toBe(post);
    expect(container.querySelector('[data-skeleton="post"]')).toBeNull();
    mocks.posts.posts = [];
    rerender(<MemoryRouter><Feed /></MemoryRouter>);
    expect(screen.getByText("No posts yet")).toBeInTheDocument();
    expect(container.querySelector('[data-skeleton="post"]')).toBeNull();
  });

  it("does not turn a failed initial feed request into an empty success", () => {
    Object.assign(mocks.posts, { loading: false, error: "Posts unavailable" });
    const { container } = render(<MemoryRouter><Feed /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("Posts unavailable");
    expect(screen.queryByText("No posts yet")).not.toBeInTheDocument();
    expect(container.querySelector('[data-skeleton="post"]')).toBeNull();
  });

  it("uses an activity toolbar and three bounded rows, then keeps loaded emptiness", () => {
    const { container, rerender } = render(<ActivityFeed />);
    expect(container.querySelectorAll('[data-skeleton="activity"]')).toHaveLength(3);
    Object.assign(mocks.activity, { hasLoaded: true, loading: true });
    rerender(<ActivityFeed />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(container.querySelector('[data-skeleton="activity"]')).toBeNull();
  });

  it("preserves the desktop inbox shell while five rows load", () => {
    const { container } = render(<MemoryRouter><Messages /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Messages" })).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Choose a conversation")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-skeleton="conversation"]')).toHaveLength(5);
  });

  it("does not unmount the composer during conversation or message refresh", () => {
    Object.assign(mocks.inbox, { hasLoaded: true, loading: false });
    Object.assign(mocks.thread, { hasLoaded: true, loading: false });
    const view = () => <MemoryRouter initialEntries={[{ pathname: "/messages", state: { conversationId: "thread-1" } }]}><Messages /></MemoryRouter>;
    const { container, rerender } = render(view());
    const draft = screen.getByRole("textbox", { name: "Message draft" });
    Object.assign(mocks.inbox, { loading: true });
    Object.assign(mocks.thread, { loading: true });
    rerender(view());
    expect(screen.getByRole("textbox", { name: "Message draft" })).toBe(draft);
    expect(draft).toHaveValue("Keep my draft");
    expect(container.querySelector('[data-skeleton="message"]')).toBeNull();
    expect(container.querySelector('[data-skeleton="conversation"]')).toBeNull();
  });

  it("resets the selected private conversation when the signed-in reader changes", () => {
    Object.assign(mocks.inbox, { hasLoaded: true, loading: false });
    Object.assign(mocks.thread, { hasLoaded: true, loading: false });
    const view = () => <MemoryRouter><Messages /></MemoryRouter>;
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Open thread" }));
    expect(screen.getByRole("textbox", { name: "Message draft" })).toBeInTheDocument();
    mocks.user = { id: "reader-2" };
    rerender(view());
    expect(screen.queryByRole("textbox", { name: "Message draft" })).not.toBeInTheDocument();
    expect(screen.getByText("Choose a conversation")).toBeInTheDocument();
  });
});
