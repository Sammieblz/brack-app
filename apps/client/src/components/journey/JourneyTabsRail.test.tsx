import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/tabs";
import { JourneyTabsRail } from "./JourneyTabsRail";

describe("JourneyTabsRail", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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

  it("reveals clipped tabs using only the rail's horizontal scroll, never vertical ancestors", () => {
    const { rerender } = render(<Tabs value="overview"><JourneyTabsRail activeTab="overview" /></Tabs>);
    const rail = screen.getByRole("tablist").parentElement!;
    Object.defineProperties(rail, {
      clientWidth: { value: 300 },
      scrollWidth: { value: 600 },
      scrollTo: { value: vi.fn() },
    });
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({ left: 0, right: 300, width: 300 } as DOMRect);
    vi.spyOn(screen.getByRole("tab", { name: "League" }), "getBoundingClientRect")
      .mockReturnValue({ left: 430, right: 520, width: 90 } as DOMRect);

    rerender(<Tabs value="rankings"><JourneyTabsRail activeTab="rankings" /></Tabs>);
    expect(rail.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 300, behavior: "auto" });
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

    vi.spyOn(screen.getByRole("tab", { name: "Badges" }), "getBoundingClientRect")
      .mockReturnValue({ left: 100, right: 190, width: 90 } as DOMRect);
    rerender(<Tabs value="badges"><JourneyTabsRail activeTab="badges" /></Tabs>);
    expect(rail.scrollTo).toHaveBeenCalledTimes(1);
  });
});
