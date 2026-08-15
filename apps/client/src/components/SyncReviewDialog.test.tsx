import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxItem } from "@/services/sync/types";

vi.stubGlobal("ResizeObserver", class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const mocks = vi.hoisted(() => ({
  discardFailedItem: vi.fn(),
  getServerBookCopySafety: vi.fn(),
  listFailedCurrentUser: vi.fn(),
  retryFailedItem: vi.fn(),
  syncCurrentUser: vi.fn(),
  toast: vi.fn(),
  useServerBookCopy: vi.fn(),
}));

vi.mock("@/services/sync/engine", () => ({
  readingCoreSync: {
    discardFailedItem: mocks.discardFailedItem,
    getServerBookCopySafety: mocks.getServerBookCopySafety,
    listFailedCurrentUser: mocks.listFailedCurrentUser,
    retryFailedItem: mocks.retryFailedItem,
    syncCurrentUser: mocks.syncCurrentUser,
    useServerBookCopy: mocks.useServerBookCopy,
  },
  SYNC_STATUS_EVENT: "brack:sync-status-changed",
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: vi.fn() }),
}));

import { SyncReviewDialog } from "./SyncReviewDialog";

const failedUpdate: OutboxItem = {
  id: "outbox-supernova",
  client_mutation_id: "mutation-supernova",
  client_entity_id: "stale-supernova",
  user_id: "user-1",
  entity: "books",
  operation: "update",
  payload: {
    title: "Supernova",
    author: "Marissa Meyer",
    isbn: "9781250078391",
    status: "reading",
  },
  status: "failed",
  attempt_count: 47,
  last_error: "Book already exists in your library",
  created_at: "2026-08-10T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  next_attempt_at: null,
};

describe("SyncReviewDialog book conflicts", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listFailedCurrentUser.mockResolvedValue([failedUpdate]);
    mocks.getServerBookCopySafety.mockResolvedValue({ safe: true, relatedChangeCount: 0 });
    mocks.retryFailedItem.mockResolvedValue({ pending: 0, failed: 0, syncing: 0 });
    mocks.syncCurrentUser.mockResolvedValue({ pending: 0, failed: 0, syncing: 0 });
    mocks.useServerBookCopy.mockResolvedValue({
      book: { id: "canonical-supernova", title: "Supernova" },
      status: { pending: 0, failed: 0, syncing: 0 },
    });
  });

  afterEach(cleanup);

  it("requires explicit confirmation before discarding a stale local update", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(
      <SyncReviewDialog
        open
        onOpenChange={vi.fn()}
        onResolved={onResolved}
      />,
    );

    const useCopyButton = await screen.findByRole("button", { name: "Use library copy" });
    expect(screen.getByRole("button", { name: "Retry & keep edits" })).toBeInTheDocument();
    expect(screen.queryByText("Attempted 47 times.")).not.toBeInTheDocument();

    await user.click(useCopyButton);
    const confirmation = screen.getByRole("alertdialog");
    expect(within(confirmation).getByText(/unsynced edits/i)).toBeInTheDocument();
    expect(mocks.useServerBookCopy).not.toHaveBeenCalled();

    await user.click(within(confirmation).getByRole("button", { name: "Keep local change" }));
    expect(mocks.useServerBookCopy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Use library copy" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Use library copy" }),
    );

    await waitFor(() => expect(mocks.useServerBookCopy).toHaveBeenCalledWith(failedUpdate));
    expect(onResolved).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Synced library copy restored",
    }));
  });

  it("does not expose cleanup while another unsynced change depends on the stale id", async () => {
    mocks.getServerBookCopySafety.mockResolvedValue({ safe: false, relatedChangeCount: 1 });
    render(<SyncReviewDialog open onOpenChange={vi.fn()} />);

    expect(await screen.findByText(/1 other unsynced reading change still depend/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use library copy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry & keep edits" })).toBeInTheDocument();
  });

  it("keeps the non-destructive reconciliation path available", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(<SyncReviewDialog open onOpenChange={vi.fn()} onResolved={onResolved} />);

    await user.click(await screen.findByRole("button", { name: "Retry & keep edits" }));

    await waitFor(() => expect(mocks.retryFailedItem).toHaveBeenCalledWith(failedUpdate));
    expect(mocks.useServerBookCopy).not.toHaveBeenCalled();
    expect(onResolved).toHaveBeenCalled();
  });

  it("presents repeated schema-cache failures as a server update instead of broken books", async () => {
    const user = userEvent.setup();
    const schemaError = "Could not find the 'shelf_position' column of 'books' in the schema cache";
    const orderChanges = [3, 4].map((shelfPosition, index): OutboxItem => ({
      ...failedUpdate,
      id: `outbox-order-${index}`,
      client_mutation_id: `mutation-order-${index}`,
      client_entity_id: `book-${index}`,
      payload: { shelf_position: shelfPosition },
      attempt_count: 1,
      last_error: schemaError,
    }));
    mocks.listFailedCurrentUser.mockResolvedValue(orderChanges);

    render(<SyncReviewDialog open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Sync service update needed")).toBeInTheDocument();
    expect(screen.getByText(/2 reading changes are safe on this device/i)).toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.getByText(schemaError)).toBeInTheDocument();
    expect(screen.queryByText("Attempted 1 time.")).not.toBeInTheDocument();
    expect(screen.queryByText("Untitled book")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Retry affected changes" }));
    await waitFor(() => {
      expect(mocks.syncCurrentUser).toHaveBeenCalledWith({ forcePending: true });
    });
  });
});
