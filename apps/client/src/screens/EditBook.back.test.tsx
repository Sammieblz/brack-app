import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { APP_HISTORY_STORAGE_KEY } from "@/lib/appHistory";
import { AppNavigationProvider } from "@/contexts/AppNavigationProvider";
import { ConfirmDialogProvider } from "@/contexts/ConfirmDialogContext";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  toast: vi.fn(),
  book: {
    id: "book-one", user_id: "reader", title: "Existing title", author: "A Reader", isbn: null,
    genre: null, pages: 200, chapters: null, cover_url: null, description: null, status: "reading",
    tags: [], metadata: null, current_page: 10, date_started: null, date_finished: null,
    rating: null, notes: null, source_provider: null, source_id: null, shelf_position: null,
    created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-01T12:00:00Z", deleted_at: null,
  } satisfies Book,
}));
vi.mock("@/utils/offlineOperation", () => ({ bookOperations: { update: mocks.update } }));
vi.mock("@/services/api", () => ({ fetchBookById: vi.fn(), uploadPublicStorageFile: vi.fn() }));
vi.mock("@/hooks/useRetainedReaderResource", () => ({ useRetainedReaderResource: () => ({ data: mocks.book, loading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader" }, loading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/hooks/useImagePicker", () => ({ useImagePicker: () => ({ pickWithPrompt: vi.fn() }) }));
vi.mock("@/components/ImagePickerDialog", () => ({ ImagePickerDialog: () => null }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: () => null }));
import EditBook from "./EditBook";

function mountEditor() {
  render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppNavigationProvider accountScope="reader">
        <ConfirmDialogProvider>
          <Routes>
            <Route path="/edit-book/:id" element={<EditBook />} />
            <Route path="/book/:id" element={<h1>Book destination</h1>} />
            <Route path="/my-books" element={<h1>Library destination</h1>} />
          </Routes>
        </ConfirmDialogProvider>
      </AppNavigationProvider>
    </BrowserRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue(undefined);
  window.sessionStorage.removeItem(APP_HISTORY_STORAGE_KEY);
  window.history.replaceState({ key: "edit-direct", idx: 4 }, "", "/edit-book/book-one");
});
afterEach(cleanup);

describe("EditBook app Back draft ownership", () => {
  it("keeps the actual form draft when the reader declines Back", async () => {
    mountEditor();
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Retained reader title" } });
    fireEvent.click(screen.getByRole("button", { name: "Back to book" }));
    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Title *")).toHaveValue("Retained reader title");
    expect(window.location.pathname).toBe("/edit-book/book-one");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("takes the explicit book destination only after the reader confirms discard", async () => {
    mountEditor();
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Unsaved reflection" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(await screen.findByRole("heading", { name: "Book destination" })).toBeVisible();
    expect(window.location.pathname).toBe("/book/book-one");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses Back during a pending write and retains the draft after rejection", async () => {
    let rejectWrite!: (error: Error) => void;
    mocks.update.mockImplementation(() => new Promise((_, reject) => { rejectWrite = reject; }));
    mountEditor();
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Draft after failure" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith("book-one", expect.objectContaining({ title: "Draft after failure", rating: null }));
    fireEvent.click(screen.getByRole("button", { name: "Back to book" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/edit-book/book-one");
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    await act(async () => { rejectWrite(new Error("Local write failed")); });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Local write failed", variant: "destructive" }));
    expect(screen.getByLabelText("Title *")).toHaveValue("Draft after failure");
    fireEvent.click(screen.getByRole("button", { name: "Back to book" }));
    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Title *")).toHaveValue("Draft after failure");
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("preserves clean Cancel behavior without a discard prompt or save", async () => {
    mountEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { name: "Book destination" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
