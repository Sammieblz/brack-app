import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JourneyBadges } from "@/components/journey/JourneyBadges";
import { LeaderboardTable } from "@/components/journey/JourneyLeague";
import { ApexChartCard } from "@/components/charts/ApexChartCard";
import { ChartSkeleton } from "./ChartSkeleton";
import { AnalyticsStatsSkeleton } from "./AnalyticsSkeleton";
import { JourneySkeleton } from "./JourneySkeleton";
import {
  EditBookSkeleton,
  GoalsSkeleton,
  ReadingHistorySkeleton,
} from "./ReadingRouteSkeletons";

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: vi.fn() }),
}));
afterEach(cleanup);

describe("reader loading geometry contracts", () => {
  it("uses the real chart card header/content shell and exact plot height", () => {
    const skeleton = render(<ChartSkeleton height={356} />);
    const plot = skeleton.container.querySelector('[style="height: 356px;"]');
    expect(plot).toHaveAttribute("data-skeleton");
    expect(plot?.parentElement).toHaveClass("px-2", "sm:px-6");
    const skeletonHeader = skeleton.container
      .querySelector("h3")
      ?.closest(".p-6");
    const skeletonHeaderClasses = skeletonHeader?.className;
    skeleton.unmount();
    const content = render(
      <ApexChartCard title="Reading activity" subtitle="Reading minutes">
        <div style={{ height: 356 }} />
      </ApexChartCard>,
    );
    expect(
      content.container.querySelector("h3")?.closest(".p-6")?.className,
    ).toBe(skeletonHeaderClasses);
  });

  it("bounds stat, badge, ranking and secondary placeholders with final layout classes", () => {
    const view = render(
      <>
        <AnalyticsStatsSkeleton />
        <JourneySkeleton tab="badges" />
        <JourneySkeleton tab="rankings" />
        <ReadingHistorySkeleton />
        <EditBookSkeleton />
        <GoalsSkeleton />
      </>,
    );
    expect(
      view.container.querySelector('[data-loading-contract="analytics-stats"]'),
    ).toHaveClass("grid-cols-2", "md:grid-cols-4", "gap-3", "md:gap-6");
    expect(
      view.container.querySelectorAll('[data-skeleton-item="badge"]'),
    ).toHaveLength(6);
    expect(
      view.container.querySelectorAll('[data-skeleton-item="standing"]'),
    ).toHaveLength(5);
    expect(
      view.container.querySelector('[data-loading-contract="reading-history"]')
        ?.children,
    ).toHaveLength(3);
    expect(
      view.container.querySelector('[data-loading-contract="goals"]'),
    ).toHaveClass("xl:grid-cols-[minmax(0,1fr)_22rem]");
    expect(
      view.container.querySelectorAll("button, input, [role=progressbar]"),
    ).toHaveLength(0);
    expect(
      view.container.querySelectorAll("[data-skeleton]").length,
    ).toBeLessThan(180);
  });

  it("transitions badges from bounded loading to true empty and keeps empty visible on refresh failure", () => {
    const props = { badges: [], earnedBadges: [], onBadgeClick: vi.fn() };
    const view = render(<JourneyBadges {...props} loading hasLoaded={false} />);
    expect(
      view.container.querySelector('[data-loading-contract="journey-badges"]'),
    ).toBeInTheDocument();
    expect(screen.queryByText("No badges configured")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    view.rerender(<JourneyBadges {...props} loading={false} hasLoaded />);
    expect(screen.getByText("No badges configured")).toBeInTheDocument();
    view.rerender(
      <JourneyBadges
        {...props}
        loading={false}
        refreshing
        hasLoaded
        error={new Error("offline")}
      />,
    );
    expect(screen.getByText("No badges configured")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not be refreshed",
    );
    expect(
      view.container.querySelector('[data-loading-contract="journey-badges"]'),
    ).not.toBeInTheDocument();
  });

  it("shows an initial badge error without falsely reporting an empty catalog", () => {
    render(
      <JourneyBadges
        badges={[]}
        earnedBadges={[]}
        loading={false}
        hasLoaded={false}
        error={new Error("offline")}
        onBadgeClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No badges configured")).not.toBeInTheDocument();
  });

  it("retains an empty ranking snapshot after a failed background refresh", () => {
    render(
      <LeaderboardTable
        entries={[]}
        loading={false}
        refreshing={false}
        cached
        hasSnapshot
        error={new Error("offline")}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("No ranked readers yet")).toBeInTheDocument();
    expect(
      screen.queryByText("Standings could not be loaded"),
    ).not.toBeInTheDocument();
  });

  it("hides revoked ranking snapshots instead of retaining private standings", () => {
    render(<LeaderboardTable entries={[]} loading={false} refreshing={false} cached hasSnapshot error={Object.assign(new Error("revoked"), { status: 403 })} onRetry={vi.fn()} />);
    expect(screen.getByText("Standings could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No ranked readers yet")).not.toBeInTheDocument();
  });
});
