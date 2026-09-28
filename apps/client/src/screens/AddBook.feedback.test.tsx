import { type ReactNode, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), create: vi.fn(), list: vi.fn(), success: vi.fn(), error: vi.fn(), books: [] as Book[],
}));
const candidate = { googleBooksId: "provider-id", title: "A searched book", author: "A. Reader" };
vi.mock("@/services/api", () => ({ getCurrentAuthUser: mocks.auth,
  isBookAlreadyExistsError: (error: { code?: string }) => error.code === "book_exists" }));
vi.mock("@/utils/offlineOperation", () => ({ bookOperations: { create: mocks.create } }));
vi.mock("@/services/local", () => ({ booksRepo: { list: mocks.list } }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/hooks/useReadingProfile", () => ({ useReadingProfile: () => ({ habits: null }) }));
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({ books: mocks.books }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: () => null }));
vi.mock("@/components/BarcodeScannerFlow", () => ({ BarcodeScannerFlow: () => <p>Scanner boundary</p> }));
vi.mock("@/components/animations/BrandedLoadingScreen", () => ({ BrandedLoadingScreen: ({ active }: { active: boolean }) => active ? <p role="status">Saving</p> : null }));
vi.mock("@/components/BookSearch", () => ({ BookSearch: ({ onQuickAdd }: { onQuickAdd: (book: typeof candidate) => Promise<void> }) => {
  const [error, setError] = useState("");
  return <><button onClick={() => void onQuickAdd(candidate).catch((reason: Error) => setError(reason.message))}>Quick add fixture</button>{error && <p role="alert">{error}</p>}</>;
} }));

import AddBook from "./AddBook";
import { ConfirmDialogProvider } from "@/contexts/ConfirmDialogContext";

function Destination() {
  const { pathname, state } = useLocation();
  return <p data-testid="destination">{pathname}:{state?.highlightBookId ?? ""}</p>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function setup(path = "/add-book?isbn=9780140328721") {
  await act(async () => { render(<ConfirmDialogProvider><MemoryRouter initialEntries={[path]}><Link to="/elsewhere">Leave form</Link><Routes>
    <Route path="/add-book" element={<AddBook />} /><Route path="*" element={<Destination />} />
  </Routes></MemoryRouter></ConfirmDialogProvider>); });
}
function submit(title = "A manual book") {
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: title } });
  fireEvent.submit(document.getElementById("add-book-form")!);
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.books = [];
  mocks.auth.mockResolvedValue({ id: "fixture-reader" });
  mocks.list.mockRejectedValue(new Error("Ancillary list unavailable"));
});
afterEach(cleanup);

describe("AddBook confirmed feedback", () => {
  it("navigates at local create completion without a second read or decoration delay", async () => {
    const pending = deferred<{ id: string; title: string }>(); mocks.create.mockReturnValue(pending.promise);
    await setup(); submit();
    expect(screen.queryByTestId("destination")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Search" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Title" })).toBeDisabled();
    await act(async () => pending.resolve({ id: "created-id", title: "A manual book" }));
    expect(screen.getByTestId("destination")).toHaveTextContent("/my-books:created-id");
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledWith("A manual book added to your library", { description: "Saved on this device. It will sync automatically." });
  });

  it("locks repeated submissions and retains the failed draft for a successful retry", async () => {
    const first = deferred<{ id: string; title: string }>(); mocks.create.mockReturnValueOnce(first.promise);
    await setup(); submit(); fireEvent.submit(document.getElementById("add-book-form")!);
    expect(mocks.create).toHaveBeenCalledOnce();
    await act(async () => first.reject(new Error("Local write failed")));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("A manual book");
    expect(screen.getByRole("button", { name: "Save Book" })).toBeEnabled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith("Local write failed");
    mocks.create.mockResolvedValueOnce({ id: "retry-id", title: "A manual book" });
    await act(async () => fireEvent.submit(document.getElementById("add-book-form")!));
    expect(screen.getByTestId("destination")).toHaveTextContent("/my-books:retry-id");
  });

  it("opens a known duplicate without creating or celebrating", async () => {
    mocks.books = [{ id: "existing-id", title: "A manual book", isbn: "9780140328721" } as Book];
    await setup(); submit();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByTestId("destination")).toHaveTextContent("/book/existing-id");
  });

  it("invalid ISBN stays editable without creating", async () => {
    await setup("/add-book?isbn=invalid"); submit();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith("Enter a valid ISBN-10 or ISBN-13");
    expect(screen.getByRole("button", { name: "Save Book" })).toBeEnabled();
  });

  it("quick-add uses the same confirmation boundary and highlight destination", async () => {
    const pending = deferred<{ id: string; title: string }>(); mocks.create.mockReturnValue(pending.promise);
    await setup("/add-book"); fireEvent.click(screen.getByRole("button", { name: "Quick add fixture" }));
    expect(screen.getByRole("tab", { name: "Manual" })).toBeDisabled();
    await act(async () => pending.resolve({ id: "quick-id", title: candidate.title }));
    expect(screen.getByTestId("destination")).toHaveTextContent("/my-books:quick-id");
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it("keeps generic quick-add error ownership with the search surface", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Quick local failure"));
    await setup("/add-book");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Quick add fixture" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Quick local failure");
    expect(mocks.error).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"])("does not navigate or toast after leaving a pending create (%s)", async (outcome) => {
    const pending = deferred<{ id: string; title: string }>(); mocks.create.mockReturnValue(pending.promise);
    await setup(); submit(); fireEvent.click(screen.getByRole("link", { name: "Leave form" }));
    await act(async () => { if (outcome === "success") pending.resolve({ id: "late-id", title: "A manual book" }); else pending.reject(new Error("Late failure")); });
    expect(screen.getByTestId("destination")).toHaveTextContent("/elsewhere:");
    expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
  });

  it("does not redirect when an initial auth read finishes after leaving", async () => {
    const auth = deferred<null>(); mocks.auth.mockReturnValueOnce(auth.promise);
    await setup(); fireEvent.click(screen.getByRole("link", { name: "Leave form" }));
    await act(async () => auth.resolve(null));
    expect(screen.getByTestId("destination")).toHaveTextContent("/elsewhere:");
  });
});
