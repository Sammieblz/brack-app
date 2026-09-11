import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { LibraryBookshelfView } from "./LibraryBookshelfView";

vi.mock("@/components/OptimizedImage", () => ({
  OptimizedImage: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
}));

vi.mock("@/components/library/LibraryBookActions", () => ({
  LibraryStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  LibraryBookDateLine: () => null,
  LibraryBookActions: ({ book, onView }: {
    book: Book;
    onView: (bookId: string) => void;
  }) => <button onClick={() => onView(book.id)}>View details</button>,
}));

const book: Book = {
  id: "shelf-book-1", user_id: "reader-1", title: "A Room of One's Own",
  author: "Virginia Woolf", isbn: null, genre: null, pages: 120,
  chapters: null, cover_url: "/cover.jpg", description: null, status: "reading",
  tags: null, metadata: null, current_page: 30, date_started: null,
  date_finished: null, rating: null, notes: null, source_provider: null,
  source_id: null, shelf_position: 0, created_at: "2026-09-11T12:00:00Z",
  updated_at: "2026-09-11T12:00:00Z", deleted_at: null,
};

const secondBook: Book = { ...book, id: "shelf-book-2", title: "Orlando", cover_url: null };

const renderShelf = (props: Partial<React.ComponentProps<typeof LibraryBookshelfView>> = {}) => {
  const onView = vi.fn();
  const onToggleSelect = vi.fn();
  const onReorder = vi.fn();
  const result = render(
    <MemoryRouter>
      <LibraryBookshelfView
        books={[book, secondBook]}
        onView={onView}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleSelect={onToggleSelect}
        onReorder={onReorder}
        {...props}
      />
    </MemoryRouter>
  );
  return { ...result, onView, onToggleSelect, onReorder };
};

describe("Library bookshelf primary interaction", () => {
  it("has one native activation surface per book, without nested controls or dormant drag semantics", () => {
    renderShelf();
    for (const item of [book, secondBook]) {
      const button = screen.getByRole("button", { name: `Open ${item.title}` });
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveAttribute("aria-haspopup", "dialog");
      expect(button).toHaveClass("library-shelf-primary");
      expect(button).not.toHaveAttribute("aria-roledescription");
      expect(button).not.toHaveAttribute("aria-describedby");
      expect(button.parentElement).not.toHaveAttribute("role");
      expect(button.parentElement).not.toHaveAttribute("tabindex");
      expect(button.parentElement?.querySelectorAll("button, [tabindex='0']")).toHaveLength(1);
      expect(button.querySelector("button, a, input")).toBeNull();
    }
  });

  it("opens the existing preview before navigating to details", async () => {
    const user = userEvent.setup();
    const { onView } = renderShelf();
    await user.click(screen.getByRole("button", { name: `Open ${book.title}` }));
    const preview = screen.getByRole("dialog", { name: book.title });
    expect(onView).not.toHaveBeenCalled();
    await user.click(within(preview).getByRole("button", { name: "View details" }));
    expect(onView).toHaveBeenCalledExactlyOnceWith(book.id);
  });

  it.each(["{Enter}", " "])("opens with native %s activation and keeps the book in one tab stop", async (key) => {
    const user = userEvent.setup();
    const { onView, onToggleSelect } = renderShelf();
    await user.tab();
    expect(screen.getByRole("button", { name: `Open ${book.title}` })).toHaveFocus();
    await user.keyboard(key);
    expect(screen.getAllByRole("dialog", { name: book.title })).toHaveLength(1);
    expect(onView).not.toHaveBeenCalled();
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it.each([390, 1024])("restores the native trigger after dismissing the real preview at %ipx", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const user = userEvent.setup();
    renderShelf();
    const button = screen.getByRole("button", { name: `Open ${book.title}` });
    await user.click(button);
    const preview = screen.getByRole("dialog", { name: book.title });
    expect(preview).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(button).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps focus inside an open preview when it changes between dialog and phone sheet", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    const user = userEvent.setup();
    renderShelf();
    const button = screen.getByRole("button", { name: `Open ${book.title}` });
    await user.click(button);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByRole("dialog", { name: book.title }))
      .toContainElement(document.activeElement as HTMLElement));
    expect(button).not.toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(button).toHaveFocus());
  });

  it.each(["{Enter}", " "])("toggles exactly once with %s in selection mode without opening", async (key) => {
    const user = userEvent.setup();
    const { onToggleSelect, onView } = renderShelf({ selectMode: true, selectedBookIds: [book.id] });
    const button = screen.getByRole("button", { name: `Select ${book.title}` });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    button.focus();
    await user.keyboard(key);
    expect(onToggleSelect).toHaveBeenCalledExactlyOnceWith(book.id);
    expect(onView).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps hover and focus off the sortable wrapper transform", async () => {
    const user = userEvent.setup();
    renderShelf();
    const button = screen.getByRole("button", { name: `Open ${book.title}` });
    const wrapper = button.parentElement!;
    const initialTransform = wrapper.style.transform;
    await user.hover(button);
    button.focus();
    fireEvent.mouseEnter(wrapper);
    fireEvent.focus(wrapper);
    expect(wrapper.style.transform).toBe(initialTransform);
    await user.unhover(button);
    expect(wrapper.style.transform).toBe(initialTransform);
  });

  it("uses the native button as the keyboard drag activator and never opens a preview", async () => {
    const user = userEvent.setup();
    const { onToggleSelect, onView, onReorder } = renderShelf({ reorderMode: true });
    const button = screen.getByRole("button", { name: `Move ${book.title}` });
    expect(button).toHaveAttribute("aria-roledescription", "sortable");
    expect(button).toHaveAttribute("aria-describedby");
    expect(button.parentElement).not.toHaveAttribute("role");
    expect(button).not.toHaveAttribute("aria-haspopup");
    button.focus();
    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Escape}");
    expect(button).not.toHaveAttribute("aria-pressed", "true");
    await user.click(button);
    expect(onToggleSelect).not.toHaveBeenCalled();
    expect(onView).not.toHaveBeenCalled();
    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never selects or opens if reorder and selection flags briefly overlap", async () => {
    const user = userEvent.setup();
    const { onToggleSelect, onView } = renderShelf({ reorderMode: true, selectMode: true });
    await user.click(screen.getByRole("button", { name: `Move ${book.title}` }));
    expect(onToggleSelect).not.toHaveBeenCalled();
    expect(onView).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
