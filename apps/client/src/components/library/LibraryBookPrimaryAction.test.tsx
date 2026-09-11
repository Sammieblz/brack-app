import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createPortal } from "react-dom";
import { useState } from "react";
import { LibraryBookCard } from "@/components/LibraryBookCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Book } from "@/types";
import { LibraryCarouselView } from "./LibraryCarouselView";
import { LibraryBookPrimaryAction } from "./LibraryBookPrimaryAction";
import { activateLibraryBookSurface } from "./activateLibraryBookSurface";

vi.mock("@/components/AddToListDialog", () => ({
  AddToListDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));
// Browser tests exercise real Embla measurements and drag/click suppression.
vi.mock("embla-carousel-react", () => ({ default: () => [() => {}, undefined] }));

const book: Book = {
  id: "book-1", user_id: "reader", title: "A Room of One's Own", author: "Virginia Woolf",
  isbn: "9780156787338", genre: "Essays", pages: 200, chapters: null, cover_url: null,
  description: "A book worth returning to.", status: "reading", tags: ["favourites"],
  metadata: null, current_page: 40, date_started: null, date_finished: null,
  rating: null, notes: "A note to keep.", source_provider: null, source_id: null,
  shelf_position: 0, created_at: "2026-09-11T12:00:00Z", updated_at: "2026-09-11T12:00:00Z", deleted_at: null,
};

function Route() { return <output data-testid="route">{useLocation().pathname}</output>; }
function renderBook(view: "flat" | "carousel" = "flat", selectMode = false) {
  const actions = { onView: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onToggleSelect: vi.fn() };
  function Example() {
    const [selected, setSelected] = useState(false);
    const toggle = (id: string) => { actions.onToggleSelect(id); setSelected((value) => !value); };
    return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TooltipProvider>
        {view === "flat" ? <LibraryBookCard book={book} {...actions} selectMode={selectMode} selected={selected} onToggleSelect={toggle} /> :
          <LibraryCarouselView books={[book]} {...actions} selectMode={selectMode} selectedBookIds={selected ? [book.id] : []} onToggleSelect={toggle} />}
        <Route />
      </TooltipProvider>
    </MemoryRouter>;
  }
  const result = render(<Example />);
  return { ...result, ...actions, surface: result.container.querySelector<HTMLElement>(".library-book-surface")! };
}

describe("Library primary card surface", () => {
  it("opens exactly once from cover, title, author, metadata, progress and surrounding space", () => {
    const { surface, onView } = renderBook();
    const targets = [surface, surface.querySelector(".library-physical-book")!, screen.getByRole("heading", { name: book.title }),
      screen.getByText(`by ${book.author}`), screen.getByText("Essays"), screen.getByText("reading"), screen.getByRole("progressbar")];
    targets.forEach((target, index) => {
      fireEvent.click(target);
      expect(onView).toHaveBeenCalledTimes(index + 1);
      expect(onView).toHaveBeenLastCalledWith(book.id);
    });
  });

  it("uses a single native primary focus stop, not nested interactive HTML", async () => {
    const { surface, onView } = renderBook();
    const primary = screen.getByRole("button", { name: `Open ${book.title}` });
    expect(primary.tagName).toBe("BUTTON");
    expect(surface).not.toHaveAttribute("role");
    expect(surface).not.toHaveAttribute("tabindex");
    expect(primary.querySelector("button,a,input,[tabindex]")).toBeNull();
    const user = userEvent.setup();
    await user.tab();
    expect(primary).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onView).toHaveBeenCalledTimes(2);
    await user.tab();
    expect(screen.getByRole("button", { name: `Expand ${book.title}` })).toHaveFocus();
  });

  it("does not open when copying metadata or clicking independent controls and portalled confirmation", async () => {
    const { onView, onEdit, onDelete } = renderBook();
    const user = userEvent.setup();
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(screen.getByRole("heading", { name: book.title }));
    selection.addRange(range);
    fireEvent.click(screen.getByRole("heading", { name: book.title }));
    expect(onView).not.toHaveBeenCalled();
    selection.removeAllRanges();
    await user.click(screen.getByRole("button", { name: `Expand ${book.title}` }));
    expect(screen.getByText(book.notes!)).toBeVisible();
    expect(onView).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Edit book" }));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(book.id);
    await user.click(screen.getByRole("button", { name: "Log progress" }));
    expect(screen.getByTestId("route")).toHaveTextContent(`/book/${book.id}/progress`);
    await user.click(screen.getByRole("button", { name: "Delete book" }));
    fireEvent.click(screen.getByText("Delete this book?"));
    await user.click(screen.getByRole("button", { name: "Keep book" }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete book" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(book.id);
    expect(onView).not.toHaveBeenCalled();
  });

  it.each(["flat", "carousel"] as const)("%s selection toggles once by surface and keyboard, never opens", async (view) => {
    const { surface, onToggleSelect, onView } = renderBook(view, true);
    const primary = screen.getByRole("button", { name: `Select ${book.title}` });
    expect(primary).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(surface);
    expect(primary).toHaveAttribute("aria-pressed", "true");
    await userEvent.setup().keyboard(" ");
    expect(primary).toHaveAttribute("aria-pressed", "false");
    expect(onToggleSelect).toHaveBeenCalledTimes(2);
    expect(onView).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit book" })).not.toBeInTheDocument();
  });

  it("carousel padding opens the existing preview and closing restores the primary focus", async () => {
    const { surface, onView } = renderBook("carousel");
    const primary = screen.getByRole("button", { name: `Open ${book.title}` });
    fireEvent.click(surface);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(onView).not.toHaveBeenCalled();
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("button", { name: "View details" })).toHaveFocus());
    // Leave the action tooltip before Escape, which otherwise dismisses the
    // innermost (tooltip) layer first, as intended by Radix.
    act(() => screen.getByRole("button", { name: "Close" }).focus());
    await userEvent.setup().keyboard("{Escape}");
    await waitFor(() => expect(primary).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Delegation exclusions", () => {
  it("leaves links, labels, role controls, editable content, prevented clicks and portal text alone", () => {
    const onActivate = vi.fn();
    render(<div onClick={(event) => activateLibraryBookSurface(event, onActivate)}>
      <LibraryBookPrimaryAction title="Example" onActivate={onActivate} />
      <a href="#target">Link</a><label>Label<input aria-label="Input" /></label>
      <span role="checkbox" aria-checked="false" tabIndex={0}>Check</span>
      <span role="switch" aria-checked="false" tabIndex={0}>Switch</span>
      <span contentEditable suppressContentEditableWarning>Editor</span>
      <span data-library-book-control>Independent area</span>
      <span onClick={(event) => event.preventDefault()}>Cancelled gesture</span>
      {createPortal(<span>Portal text</span>, document.body)}
    </div>);
    for (const name of ["Link", "Label", "Check", "Switch", "Editor", "Independent area", "Cancelled gesture", "Portal text"]) {
      fireEvent.click(screen.getByText(name));
    }
    fireEvent.click(screen.getByRole("button", { name: "Open Example" }), { button: 2 });
    expect(onActivate).not.toHaveBeenCalled();
  });
});
