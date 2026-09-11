import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/tabs";
import { JourneyTabsRail } from "./JourneyTabsRail";

describe("JourneyTabsRail", () => {
  let restoreScrollIntoView: () => void;

  beforeEach(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    restoreScrollIntoView = () => {
      if (original) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    restoreScrollIntoView();
    vi.clearAllMocks();
  });

  it("keeps all five section labels visible and calls rankings League", () => {
    render(
      <Tabs value="rankings">
        <JourneyTabsRail activeTab="rankings" />
      </Tabs>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "Overview" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Quests" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Shop" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Badges" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "League" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Ranks" })).not.toBeInTheDocument();
    const tabList = screen.getByRole("tablist", { name: "Reader Journey sections" });
    expect(tabList).toHaveClass("min-w-full", "w-max");
    expect(tabList.parentElement).toHaveClass("w-full", "overflow-x-auto");
  });

  it("reserves the same rail while Journey data is loading", () => {
    const { rerender } = render(<Tabs value="overview"><JourneyTabsRail activeTab="overview" disabled /></Tabs>);
    const rail = screen.getByRole("tablist").parentElement;
    for (const tab of screen.getAllByRole("tab")) expect(tab).toBeDisabled();

    rerender(<Tabs value="overview"><JourneyTabsRail activeTab="overview" /></Tabs>);
    expect(screen.getByRole("tablist").parentElement).toBe(rail);
    for (const tab of screen.getAllByRole("tab")) expect(tab).toBeEnabled();
  });

  it.each([
    { scenario: "clipped right", tabLeft: 380, scrollLeft: 0, expected: 225 },
    { scenario: "right boundary", tabLeft: 480, scrollLeft: 0, expected: 300 },
    { scenario: "clipped left with an existing offset", tabLeft: -30, scrollLeft: 200, expected: 15 },
    { scenario: "left boundary", tabLeft: -200, scrollLeft: 200, expected: 0 },
    { scenario: "already visible", tabLeft: 100, scrollLeft: 100, expected: null },
  ])("reveals $scenario using only horizontal rail scrolling", ({ tabLeft, scrollLeft, expected }) => {
    const { rerender } = render(<Tabs value="overview"><JourneyTabsRail activeTab="overview" /></Tabs>);
    const rail = screen.getByRole("tablist").parentElement!;
    Object.defineProperties(rail, {
      clientWidth: { value: 300 },
      scrollWidth: { value: 600 },
      scrollTo: { value: vi.fn() },
    });
    rail.scrollLeft = scrollLeft;
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue(new DOMRect(50, 0, 300, 44));
    vi.spyOn(screen.getByRole("tab", { name: "League" }), "getBoundingClientRect")
      .mockReturnValue(new DOMRect(tabLeft, 0, 90, 44));

    rerender(<Tabs value="rankings"><JourneyTabsRail activeTab="rankings" /></Tabs>);
    if (expected === null) expect(rail.scrollTo).not.toHaveBeenCalled();
    else expect(rail.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: expected, behavior: "auto" });
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
