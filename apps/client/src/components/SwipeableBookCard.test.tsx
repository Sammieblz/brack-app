import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPortal } from "react-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { SwipeableBookCard } from "./SwipeableBookCard";
import { registerBackLayer } from "@/lib/backLayers";

const mocks = vi.hoisted(() => ({
  haptic: vi.fn(),
  reducedMotion: false,
}));

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
        <button type="button" className="library-book-primary" onClick={open}>Open Orlando</button>
        <button type="button">More actions</button>
        <input aria-label="Reading note" />
        <span data-gesture-ignore>Selectable annotation</span>
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
  fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: x, clientY: y }] });
};

const move = (target: HTMLElement, x: number, y = 80) => {
  const event = createEvent.touchMove(target, { touches: [{ identifier: 1, clientX: x, clientY: y }], cancelable: true });
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
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(remove).toHaveBeenCalledExactlyOnceWith(book.id);
    expect(open).not.toHaveBeenCalled();
  });

  it("retains the card and open removal when swipe presentation is disabled, then focuses the surviving book control", async () => {
    const remove = vi.fn();
    const card = (enabled: boolean) => <SwipeableBookCard book={book} enabled={enabled} onDelete={remove}>
      <article className="library-book-surface"><button className="library-book-primary">Open Orlando</button><input aria-label="Reading note" /></article>
    </SwipeableBookCard>;
    const view = render(card(true));
    const primary = screen.getByRole("button", { name: "Open Orlando" });
    const input = screen.getByRole("textbox", { name: "Reading note" });
    fireEvent.change(input, { target: { value: "Keep this note" } });
    swipeLeft(primary);
    fireEvent.click(screen.getByRole("button", { name: "Delete book" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this book?" });
    view.rerender(card(false));
    expect(screen.getByRole("dialog", { name: "Delete this book?" })).toBe(dialog);
    expect(input).toHaveValue("Keep this note");
    expect(input.isConnected).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Keep book" }));
    await waitFor(() => expect(primary).toHaveFocus());
    swipeLeft(primary);
    expect(screen.queryByRole("button", { name: "Delete book" })).not.toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
  });

  it("never treats a portaled backdrop click as a card activation or a cancelled swipe click", () => {
    const open = vi.fn();
    const portalClick = vi.fn();
    render(<SwipeableBookCard book={book} onView={open}>
      <article className="library-book-surface"><button className="library-book-primary">Open Orlando</button>
        {createPortal(<div data-testid="nested-backdrop" onClick={portalClick} />, document.body)}
      </article>
    </SwipeableBookCard>);
    const backdrop = screen.getByTestId("nested-backdrop");
    fireEvent.click(backdrop, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
    const primary = screen.getByRole("button", { name: "Open Orlando" });
    swipeLeft(primary);
    fireEvent.click(backdrop, { detail: 1 });
    expect(portalClick).toHaveBeenCalledTimes(2);
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

  it.each([2, 24, window.innerWidth - 2, window.innerWidth - 24])("leaves the system edge at x=%s unclaimed", (x) => {
    const { primary, sliding, open } = renderCard();
    start(primary, x);
    expect(move(primary, x - 140).defaultPrevented).toBe(false);
    end(primary);
    expect(sliding.style.transform).toBe("translateX(0px)");
    fireEvent.click(primary, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
    expect(mocks.haptic).not.toHaveBeenCalled();
    start(primary, x);
    end(primary);
    fireEvent.click(primary, { detail: 1 });
    expect(open).toHaveBeenCalledOnce();
  });

  it.each(["More actions", "Reading note", "Selectable annotation"])("does not claim a gesture on %s", (name) => {
    const { sliding } = renderCard();
    const target = screen.queryByLabelText(name) ?? screen.getByText(name);
    start(target);
    expect(move(target, 100).defaultPrevented).toBe(false);
    end(target);
    expect(sliding.style.transform).toBe("translateX(0px)");
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it.each(["blur", "pagehide", "scroll", "contextmenu"])("cancels on %s without reviving on a late touchend", (event) => {
    const { primary, sliding, open } = renderCard();
    start(primary);
    move(primary, 100);
    fireEvent(window, new Event(event));
    expect(sliding.style.transform).toBe("translateX(0px)");
    expect(move(primary, 90).defaultPrevented).toBe(false);
    end(primary);
    fireEvent.click(primary, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
    expect(mocks.haptic).not.toHaveBeenCalled();
    start(primary);
    end(primary);
    fireEvent.click(primary, { detail: 1 });
    expect(open).toHaveBeenCalledOnce();
  });

  it("cancels for a second touch anywhere, leaving pinch default behavior available", () => {
    const { primary, sliding } = renderCard();
    start(primary);
    move(primary, 100);
    const second = createEvent.touchStart(document.body, {
      touches: [{ identifier: 1, clientX: 100, clientY: 80 }, { identifier: 2, clientX: 190, clientY: 80 }],
      cancelable: true,
    });
    fireEvent(document.body, second);
    expect(second.defaultPrevented).toBe(false);
    expect(sliding.style.transform).toBe("translateX(0px)");
    expect(move(primary, 90).defaultPrevented).toBe(false);
    end(primary);
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it("cancels when the tracked finger is replaced", () => {
    const { primary, sliding } = renderCard();
    start(primary);
    move(primary, 100);
    fireEvent.touchMove(primary, { touches: [{ identifier: 2, clientX: 90, clientY: 80 }] });
    end(primary);
    expect(sliding.style.transform).toBe("translateX(0px)");
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it("does not start on selected text and cancels when a selection appears mid-contact", () => {
    const selection = window.getSelection()!;
    const { primary, sliding } = renderCard();
    const range = document.createRange();
    range.selectNodeContents(screen.getByText("Metadata"));
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.toString()).toBe("Metadata");
    start(primary);
    expect(move(primary, 100).defaultPrevented).toBe(false);
    end(primary);
    selection.removeAllRanges();
    start(primary);
    move(primary, 100);
    selection.addRange(range);
    fireEvent(document, new Event("selectionchange"));
    end(primary);
    expect(sliding.style.transform).toBe("translateX(0px)");
    expect(mocks.haptic).not.toHaveBeenCalled();
    selection.removeAllRanges();
  });

  it("cancels an active contact when the document becomes hidden", () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const { primary, sliding } = renderCard();
    start(primary);
    move(primary, 100);
    fireEvent(document, new Event("visibilitychange"));
    end(primary);
    expect(sliding.style.transform).toBe("translateX(0px)");
    expect(mocks.haptic).not.toHaveBeenCalled();
    hidden.mockRestore();
  });

  it.each(["before start", "before release"])("yields to an overlay opened %s without dismissing it", (timing) => {
    const { primary, sliding } = renderCard();
    const overlay = document.createElement("div");
    overlay.dataset.state = "open";
    const register = () => { document.body.append(overlay); return registerBackLayer(overlay); };
    let unregister: (() => void) | undefined;
    try {
      if (timing === "before start") unregister = register();
      start(primary);
      move(primary, 100);
      if (timing === "before release") unregister = register();
      end(primary);
      expect(sliding.style.transform).toBe("translateX(0px)");
      expect(mocks.haptic).not.toHaveBeenCalled();
      expect(overlay.dataset.state).toBe("open");
    } finally {
      unregister?.(); overlay.remove();
    }
  });

  it("does not install contact listeners while idle and removes them on end or unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { primary, unmount } = renderCard();
    const contactAdds = () => add.mock.calls.filter(([type]) => type === "touchstart");
    expect(contactAdds()).toHaveLength(0);
    start(primary);
    const observer = contactAdds()[0][1];
    end(primary);
    expect(remove).toHaveBeenCalledWith("touchstart", observer, true);
    start(primary);
    const nextObserver = contactAdds()[1][1];
    unmount();
    expect(remove).toHaveBeenCalledWith("touchstart", nextObserver, true);
    add.mockRestore();
    remove.mockRestore();
  });
});
