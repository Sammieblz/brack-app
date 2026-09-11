import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookList } from "@/hooks/useBookLists";

const state = vi.hoisted(() => ({
  lists: [] as BookList[], loading: false, refreshing: false, hasLoaded: true,
  loadingMore: false, hasMore: false, error: null as string | null,
  loadMore: vi.fn(), refetch: vi.fn(), createList: vi.fn(), updateList: vi.fn(), deleteList: vi.fn(), duplicateList: vi.fn(),
}));
vi.mock("@/hooks/useBookLists", () => ({ useBookLists: () => state }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/hooks/useInfiniteScroll", () => ({ useInfiniteScroll: () => ({ current: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/PullToRefresh", () => ({ PullToRefresh: ({ children, onRefresh }: { children: ReactNode; onRefresh: () => Promise<void> }) => <><button aria-label="Refresh lists" onClick={() => void onRefresh()} />{children}</> }));
vi.mock("@/components/empty/PremiumEmptyState", () => ({ PremiumEmptyState: ({ title, description, action }: { title: string; description: string; action: ReactNode }) => <div><h2>{title}</h2><p>{description}</p>{action}</div> }));

import { BookListManager } from "./BookListManager";

const list = {
  id: "list-a", user_id: "user-a", name: "Cached list", description: "For the weekend",
  book_count: 2, created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-02T12:00:00Z", is_public: false,
} as BookList;
const view = () => <MemoryRouter><BookListManager userId="user-a" /></MemoryRouter>;

beforeEach(() => {
  state.lists = [list];
  state.loading = false;
  state.refreshing = false;
  state.hasLoaded = true;
  state.error = null;
  state.loadingMore = false;
  state.refetch.mockReset().mockResolvedValue(undefined);
});

describe("Book List manager loading presentation", () => {
  it("preserves the card and search input during refresh", () => {
    const { rerender, container } = render(view());
    fireEvent.change(screen.getByPlaceholderText("Search lists by name or description"), { target: { value: "Cached" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh lists" }));
    expect(state.refetch).toHaveBeenCalledOnce();
    state.refreshing = true;
    rerender(view());
    expect(screen.getByPlaceholderText("Search lists by name or description")).toHaveValue("Cached");
    expect(screen.getByRole("heading", { name: "Cached list" })).toBeVisible();
    expect(container.querySelector('[data-skeleton="book-list-card"]')).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Updating");
  });

  it("keeps a confirmed empty collection visible while refreshing", () => {
    state.lists = [];
    state.refreshing = true;
    const { container } = render(view());
    expect(screen.getByRole("heading", { name: "Create your first list" })).toBeVisible();
    expect(container.querySelector('[data-skeleton="book-list-card"]')).toBeNull();
  });

  it("has one owning busy status during a cold load and no false empty message", () => {
    state.lists = [];
    state.hasLoaded = false;
    state.loading = true;
    const { container } = render(view());
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-skeleton="book-list-card"]')).toHaveLength(6);
    expect(screen.queryByText("Create your first list")).toBeNull();
  });

  it("renders retry rather than an empty collection after a cold failure", () => {
    state.lists = [];
    state.hasLoaded = false;
    state.error = "We couldn't load your book lists. Please try again.";
    render(view());
    expect(screen.getByRole("alert")).toHaveTextContent(state.error);
    expect(screen.queryByText("Create your first list")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });
});
