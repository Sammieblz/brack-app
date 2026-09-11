import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { SwipeableBookCard } from "./SwipeableBookCard";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn().mockResolvedValue(true),
  haptic: vi.fn(),
  reducedMotion: false,
}));

vi.mock("@/contexts/ConfirmDialogContext", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mocks.reducedMotion }));

const book: Book = {
  id: "swipe-book", user_id: "reader", title: "Orlando", author: "Virginia Woolf",
  isbn: null, genre: null, pages: 200, chapters: null, cover_url: null,
  description: null, status: "reading", tags: null, metadata: null,
  current_page: 30, date_started: null, date_finished: null, rating: null,
  notes: null, source_provider: null, source_id: null, shelf_position: 0,
  created_at: "2026-09-11T12:00:00Z", updated_at: "2026-09-11T12:00:00Z", deleted_at: null,
};

const renderCard = () => {
  const open = vi.fn();
  const fallbackOpen = vi.fn();
  const edit = vi.fn();
  const remove = vi.fn();
  const status = vi.fn();
  const result = render(
    <SwipeableBookCard book={book} onView={fallbackOpen} onEdit={edit} onDelete={remove} onStatusChange={status}>
      <article className="library-book-surface">
        <button type="button" onClick={open}>Open Orlando</button>
        <span>Metadata</span>
      </article>
    </SwipeableBookCard>
  );
  const primary = screen.getByRole("button", { name: "Open Orlando" });
  const sliding = primary.closest("article")!.parentElement!;
  return { ...result, primary, sliding, open, fallbackOpen, edit, remove, status };
};

const start = (target: HTMLElement, x = 250, y = 80) => {
  fireEvent.pointerDown(target, { pointerType: "touch", pointerId: 1 });
  fireEvent.touchStart(target, { touches: [{ clientX: x, clientY: y }] });
};

const move = (target: HTMLElement, x: number, y = 80) => {
  const event = createEvent.touchMove(target, { touches: [{ clientX: x, clientY: y }], cancelable: true });
  fireEvent(target, event);
  return event;
};

const end = (target: HTMLElement) => fireEvent.touchEnd(target, { touches: [] });

const swipeLeft = (target: HTMLElement, distance = 140) => {
  start(target);
  move(target, 250 - distance);
  end(target);
};

describe("Swipeable book gesture isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reducedMotion = false;
    mocks.confirm.mockResolvedValue(true);
  });

  it("opens once on a normal tap, without the wrapper duplicating the card action", () => {
    const { primary, open, fallbackOpen } = renderCard();
    start(primary);
    end(primary);
    fireEvent.click(primary, { detail: 1 });
    expect(open).toHaveBeenCalledTimes(1);
    expect(fallbackOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Metadata"), { detail: 1 });
    expect(fallbackOpen).not.toHaveBeenCalled();
  });

  it("follows horizontal swipes directly, then suppresses the synthesized child click", () => {
    const { primary, sliding, open } = renderCard();
    start(primary);
    expect(move(primary, 110).defaultPrevented).toBe(true);
    expect(sliding.style.transform).toBe("translateX(-140px)");
    expect(sliding.style.transition).toBe("none");
    end(primary);
    expect(sliding.style.transform).toBe("translateX(-200px)");
    expect(screen.getByRole("button", { name: "Edit book" })).toBeInTheDocument();
    expect(fireEvent.click(primary, { detail: 1 })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it("also suppresses a click after a short swipe that snaps closed", () => {
    const { primary, sliding, open } = renderCard();
    swipeLeft(primary, 40);
    expect(sliding.style.transform).toBe("translateX(0px)");
    fireEvent.click(primary, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
  });

  it("keeps vertical scrolling native and does not open a book after it", () => {
    const { primary, sliding, open } = renderCard();
    start(primary);
    expect(move(primary, 247, 30).defaultPrevented).toBe(false);
    // Direction remains vertical even if the finger later travels sideways.
    expect(move(primary, 100, 25).defaultPrevented).toBe(false);
    end(primary);
    expect(sliding.style.transform).toBe("translateX(0px)");
    expect(screen.queryByRole("button", { name: "Edit book" })).not.toBeInTheDocument();
    fireEvent.click(primary, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
  });

  it("allows a fresh tap and keyboard activation after a swipe", async () => {
    const user = userEvent.setup();
    const { primary, open } = renderCard();
    swipeLeft(primary, 40);
    primary.focus();
    await user.keyboard("{Enter} ");
    expect(open).toHaveBeenCalledTimes(2);
    start(primary);
    end(primary);
    fireEvent.click(primary, { detail: 1 });
    expect(open).toHaveBeenCalledTimes(3);
  });

  it("keeps a deliberate action tap separate from opening the book", () => {
    const { primary, open, edit, fallbackOpen } = renderCard();
    swipeLeft(primary);
    const editButton = screen.getByRole("button", { name: "Edit book" });
    start(editButton);
    end(editButton);
    fireEvent.click(editButton, { detail: 1 });
    expect(edit).toHaveBeenCalledExactlyOnceWith(book.id);
    expect(open).not.toHaveBeenCalled();
    expect(fallbackOpen).not.toHaveBeenCalled();
  });

  it("keeps status changes and confirmed deletion separate from opening", async () => {
    const user = userEvent.setup();
    const { primary, open, status, remove } = renderCard();
    swipeLeft(primary);
    await user.click(screen.getByRole("button", { name: "Mark as complete" }));
    expect(status).toHaveBeenCalledExactlyOnceWith(book.id, "completed");
    swipeLeft(primary);
    await user.click(screen.getByRole("button", { name: "Delete book" }));
    expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledExactlyOnceWith(book.id);
    expect(open).not.toHaveBeenCalled();
  });

  it("restores the resting offset and suppresses activation after a cancelled gesture", () => {
    const { primary, sliding, open } = renderCard();
    start(primary);
    move(primary, 100);
    fireEvent.touchCancel(primary, { touches: [] });
    expect(sliding.style.transform).toBe("translateX(0px)");
    fireEvent.click(primary, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
  });

  it("closes an open tray with a right swipe without jumping at gesture start", () => {
    const { primary, sliding, open } = renderCard();
    swipeLeft(primary);
    start(primary, 30);
    move(primary, 80);
    expect(sliding.style.transform).toBe("translateX(-150px)");
    end(primary);
    expect(sliding.style.transform).toBe("translateX(0px)");
    fireEvent.click(primary, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
  });

  it("has no decorative release transition with reduced motion", () => {
    mocks.reducedMotion = true;
    const { primary, sliding } = renderCard();
    swipeLeft(primary);
    expect(sliding.style.transition).toBe("none");
  });
});
