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

  afterEach(cleanup);

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
});
