import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NativeHeader } from "./NativeHeader";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({ books: [], loading: false }) }));
vi.mock("@/components/HeaderTimerWidget", () => ({ HeaderTimerWidget: () => null }));
vi.mock("@/components/UserNotificationsPopover", () => ({ UserNotificationsPopover: () => null }));

describe("NativeHeader scroll contract", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // jsdom verifies DOM continuity and behavior here. Playwright measures real
  // sticky positions, sizes, and content offsets in the shell browser suite.
  it("preserves title, subtitle, Back action and secondary controls across scroll reversals", () => {
    const onBack = vi.fn();
    const onAction = vi.fn();
    const listen = vi.spyOn(EventTarget.prototype, "addEventListener");
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <main data-app-scroll-container="true">
          <NativeHeader
            title="My Library"
            subtitle="Manage your personal collection"
            back={{ label: "Library", onBack }}
            action={<button onClick={onAction}>Add book</button>}
            secondary={<nav aria-label="Library sections">All books</nav>}
          />
          <section id="library-scroll">Books</section>
        </main>
      </MemoryRouter>,
    );
    const owner = screen.getByRole("main");
    const header = screen.getByRole("banner");
    const title = screen.getByRole("heading", { level: 1, name: "My Library" });
    const subtitle = screen.getByText("Manage your personal collection");
    const back = screen.getByRole("button", { name: "Library" });
    const secondary = screen.getByRole("navigation", { name: "Library sections" });
    const initial = header.outerHTML;

    for (const scrollTop of [49, 51, 80, 51, 49, 0]) {
      owner.scrollTop = scrollTop;
      vi.stubGlobal("scrollY", scrollTop);
      fireEvent.scroll(owner);
      fireEvent.scroll(window);
      expect(header.outerHTML).toBe(initial);
      for (const element of [title, subtitle, back, secondary]) {
        expect(element).toBeVisible();
        expect(header).toContainElement(element);
      }
    }
    const headerSubscriptions = listen.mock.calls.filter(([type], index) =>
      type === "scroll" && [owner, header, window].some((target) => target === listen.mock.contexts[index]),
    );
    expect(headerSubscriptions).toEqual([]);
    // The shell owns header geometry, not the shared button's hover styling.
    for (const element of [header, title, subtitle, ...header.querySelectorAll(".app-page-header")]) {
      expect(element).not.toHaveClass("transition-all");
    }
    fireEvent.click(back);
    fireEvent.click(screen.getByRole("button", { name: "Add book" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("connects the complete header, including secondary controls, to its owner's measured height", () => {
    const observe = vi.spyOn(ResizeObserver.prototype, "observe");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, 0, 800, this.tagName === "HEADER" ? 189 : 40);
    });
    render(
      <main data-app-scroll-container="true">
        <NativeHeader title="Reader Journey" secondary={<nav aria-label="Journey sections">Overview</nav>} />
      </main>,
    );
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("navigation"));
    expect(observe).toHaveBeenCalledExactlyOnceWith(screen.getByRole("banner"), { box: "border-box" });
    expect(screen.getByRole("main").style.getPropertyValue("--app-header-height")).toBe("189px");
  });
});
