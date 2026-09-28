import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui/dialog";
import { AdaptiveDialogContent, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import type { UIEnvironment } from "@/services/uiEnvironment";

const mocks = vi.hoisted(() => ({
  windowClass: "medium" as UIEnvironment["windowClass"],
  startTimer: vi.fn(), retry: vi.fn(), streak: vi.fn(),
  books: {
    books: [{ id: "reading-book", title: "A book in progress", author: "A reader", status: "reading", pages: 320, current_page: 0, date_finished: null as string | null }],
    loading: false, refreshing: false, hasLoaded: true, error: null as string | null,
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader" } }) }));
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({ ...mocks.books, refetchBooks: mocks.retry }) }));
vi.mock("@/hooks/useStreaks", () => ({ useStreaks: mocks.streak }));
vi.mock("@/contexts/TimerContext", () => ({ useTimer: () => ({ startTimer: mocks.startTimer }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/hooks/useUIEnvironment", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/hooks/useUIEnvironment")>(),
  useUIEnvironmentValue: (selector: (environment: Pick<UIEnvironment, "windowClass">) => unknown) =>
    selector({ windowClass: mocks.windowClass }),
}));
import { FloatingActionButton } from "./FloatingActionButton";

const fixture = <MemoryRouter><FloatingActionButton /></MemoryRouter>;
const openActions = () => fireEvent.click(screen.getByRole("button", { name: "Quick actions" }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.windowClass = "medium";
  mocks.startTimer.mockReset();
  mocks.streak.mockReturnValue({ streakData: { currentStreak: 4 }, loading: false });
  mocks.books = {
    books: [{ id: "reading-book", title: "A book in progress", author: "A reader", status: "reading", pages: 320, current_page: 0, date_finished: null }],
    loading: false, refreshing: false, hasLoaded: true, error: null,
  };
});

describe("Library quick actions", () => {
  it("keeps actions out of the closed surface and restores focus after dismissal", async () => {
    render(fixture);
    expect(screen.queryByRole("button", { name: "Scan Cover" })).not.toBeInTheDocument();
    expect(mocks.streak).not.toHaveBeenCalled();
    openActions();
    const actions = within(screen.getByRole("dialog", { name: "Quick actions" }));
    expect(actions.getAllByRole("button")[0]).toHaveTextContent("Add Book");
    fireEvent.click(actions.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Quick actions" })).toHaveFocus());
  });

  it.each([
    ["Add Book", "/add-book"], ["Search Books", "/add-book"],
    ["Scan Barcode", "/scan-barcode"], ["Scan Cover", "/scan-cover"],
    ["Reading History", "/history"],
  ])("keeps %s connected to its canonical destination", async (action, destination) => {
    render(<MemoryRouter initialEntries={["/my-books"]}><Routes>
      <Route path="/my-books" element={<FloatingActionButton />} />
      <Route path={destination} element={<h1>Requested destination</h1>} />
    </Routes></MemoryRouter>);
    openActions();
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(await screen.findByRole("heading", { name: "Requested destination" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hands focus to the timer picker and starts one selected book without premature success feedback", async () => {
    render(fixture);
    openActions();
    fireEvent.click(screen.getByRole("button", { name: "Start Reading Timer" }));
    const dialog = await screen.findByRole("dialog", { name: "Start reading timer" });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: /A book in progress/ }));
    expect(mocks.startTimer).toHaveBeenCalledExactlyOnceWith("reading-book", "A book in progress");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Quick actions" })).toHaveFocus());
  });

  it("preserves a replacement confirmation opened by the timer provider", async () => {
    function TimerOwner() {
      const [confirm, setConfirm] = useState(false);
      mocks.startTimer.mockImplementation(() => setConfirm(true));
      return <MemoryRouter><FloatingActionButton /><Dialog open={confirm} onOpenChange={setConfirm}>
        <AdaptiveDialogContent aria-describedby={undefined}>
          <AdaptiveDialogTitle>Replace the current timer?</AdaptiveDialogTitle>
          <button type="button">Keep current timer</button>
        </AdaptiveDialogContent>
      </Dialog></MemoryRouter>;
    }
    render(<TimerOwner />);
    openActions();
    fireEvent.click(screen.getByRole("button", { name: "Start Reading Timer" }));
    fireEvent.click(screen.getByRole("button", { name: /A book in progress/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep current timer" })).toHaveFocus());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("distinguishes timer loading and failure from an empty reading list, with retry", async () => {
    mocks.books = { ...mocks.books, books: [], loading: true, hasLoaded: false };
    const view = render(fixture);
    openActions();
    fireEvent.click(screen.getByRole("button", { name: "Start Reading Timer" }));
    expect(screen.getByLabelText("Loading books for the reading timer")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("No books currently being read")).not.toBeInTheDocument();
    mocks.books = { ...mocks.books, loading: false, error: "offline" };
    view.rerender(<MemoryRouter><FloatingActionButton /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("Reading books could not be refreshed.");
    expect(screen.queryByText("No books currently being read")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.retry).toHaveBeenCalledOnce();
    mocks.books = { ...mocks.books, error: null, hasLoaded: true };
    view.rerender(<MemoryRouter><FloatingActionButton /></MemoryRouter>);
    expect(screen.getByText("No books currently being read")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Quick actions" })).toHaveFocus());
  });

  it("shows the same stats in a modal, labels the existing time estimate truthfully and returns focus", async () => {
    mocks.books.books.push({
      id: "completed-book", title: "Finished book", author: "A reader", status: "completed",
      pages: 320, current_page: 320, date_finished: new Date().toISOString(),
    });
    render(fixture);
    openActions();
    fireEvent.click(screen.getByRole("button", { name: "Quick Stats" }));
    const dialog = await screen.findByRole("dialog", { name: "Quick stats" });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(dialog).getByText("Books this month").nextElementSibling).toHaveTextContent("1");
    expect(within(dialog).getByText("Day streak").nextElementSibling).toHaveTextContent("4");
    expect(within(dialog).getByText("Estimated reading time").nextElementSibling).toHaveTextContent("8h");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Quick actions" })).toHaveFocus());
  });

  it.each(["Quick actions", "Start reading timer", "Quick stats"])("preserves the open %s task after expansion and closes to the page heading", async (surface) => {
    const tree = <MemoryRouter><main data-app-scroll-container><h1>Library</h1><FloatingActionButton /></main></MemoryRouter>;
    const view = render(tree);
    openActions();
    if (surface === "Start reading timer") fireEvent.click(screen.getByRole("button", { name: "Start Reading Timer" }));
    if (surface === "Quick stats") fireEvent.click(screen.getByRole("button", { name: "Quick Stats" }));
    const dialog = await screen.findByRole("dialog", { name: surface });
    mocks.windowClass = "expanded";
    view.rerender(<MemoryRouter><main data-app-scroll-container><h1>Library</h1><FloatingActionButton /></main></MemoryRouter>);
    expect(screen.getByRole("dialog", { name: surface })).toBe(dialog);
    expect(screen.queryByRole("button", { name: "Quick actions" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("heading", { name: "Library" })).toHaveFocus());
  });
});
