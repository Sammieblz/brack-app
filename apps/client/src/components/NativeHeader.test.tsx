import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { NativeHeader } from "./NativeHeader";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({ books: [], loading: false }) }));
vi.mock("@/components/HeaderTimerWidget", () => ({ HeaderTimerWidget: () => null }));
vi.mock("@/components/UserNotificationsPopover", () => ({ UserNotificationsPopover: () => null }));

describe("NativeHeader scroll geometry", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("keeps its title, subtitle and layout classes unchanged across scroll reversals", () => {
    const { container } = render(
      <main data-app-scroll-container="true">
        <NativeHeader title="My Library" subtitle="Manage your personal collection" />
        <section id="library-scroll">Books</section>
      </main>,
    );
    const owner = container.querySelector("main")!;
    const header = screen.getByRole("banner");
    const initial = header.innerHTML;
    for (const scrollTop of [49, 51, 80, 51, 49, 0]) {
      act(() => {
        owner.scrollTop = scrollTop;
        owner.dispatchEvent(new Event("scroll"));
        window.dispatchEvent(new Event("scroll"));
      });
      expect(header.innerHTML).toBe(initial);
      expect(screen.getByText("Manage your personal collection")).toBeVisible();
    }
    expect(header.querySelector(".transition-all")).toBeNull();
    expect(header).not.toHaveClass("transition-all");
  });
});
