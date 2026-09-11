import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsChartData } from "@/services/api";

const mocks = vi.hoisted(() => ({
  chart: {} as AnalyticsChartData & {
    data?: AnalyticsChartData;
    loading: boolean;
    refreshing: boolean;
    error: Error | null;
    refetch: () => void;
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader" } }) }));
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({ books: [], loading: false }) }));
vi.mock("@/hooks/useChartData", () => ({ useChartData: () => mocks.chart }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ currentTheme: "default", resolvedTheme: "light" }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
// Only the external renderer is replaced: real chart/card/title/subtitle markup stays under test.
vi.mock("react-apexcharts", () => ({ default: ({ height }: { height: number }) => <div data-testid="chart-plot" style={{ height }} /> }));

import Analytics from "./Analytics";

const emptyData = (): AnalyticsChartData => ({
  readingProgress: [], genreData: [], weeklyReading: [], readingVelocity: [],
  completionRate: [], heatmapData: [], scatterData: [], monthlyGoals: [],
  streakTimeline: [], paceData: [], topAuthors: [], timeDistribution: [], statusFunnel: [],
});

beforeEach(() => {
  mocks.chart = { ...emptyData(), loading: true, refreshing: false, error: null, refetch: vi.fn() };
});
afterEach(cleanup);

describe("Analytics loading contract", () => {
  it("keeps the heading and tabs mounted and replaces one 320px plot with the real chart", async () => {
    const view = render(<Analytics />);
    const heading = screen.getByRole("heading", { name: "Analytics Dashboard" });
    const overview = screen.getByRole("tab", { name: "Overview" });
    expect(view.container.querySelectorAll('[data-loading-contract="chart"]')).toHaveLength(1);
    expect(view.container.querySelector('[style="height: 320px;"]')).toBeInTheDocument();
    const data = { ...emptyData(), readingProgress: [{ date: "2026-09-01", minutes: 30, books: 1 }] };
    mocks.chart = { ...mocks.chart, ...data, data, loading: false };
    view.rerender(<Analytics />);
    await waitFor(() => expect(screen.getByTestId("chart-plot")).toHaveStyle({ height: "320px" }));
    expect(screen.getByRole("heading", { name: "Analytics Dashboard" })).toBe(heading);
    expect(screen.getByRole("tab", { name: "Overview" })).toBe(overview);
    expect(view.container.querySelector('[data-loading-contract="chart"]')).not.toBeInTheDocument();

    const plot = screen.getByTestId("chart-plot");
    mocks.chart = { ...mocks.chart, refreshing: true };
    view.rerender(<Analytics />);
    expect(screen.getByTestId("chart-plot")).toBe(plot);
    expect(view.container.querySelector('[aria-label="Loading analytics"]')).toHaveAttribute("aria-busy", "true");
  });

  it("distinguishes genuine empty data from a failed initial load", () => {
    mocks.chart = { ...mocks.chart, loading: false, error: new Error("offline") };
    const view = render(<Analytics />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No analytics data yet")).not.toBeInTheDocument();
    const data = emptyData();
    mocks.chart = { ...mocks.chart, ...data, data, error: null };
    view.rerender(<Analytics />);
    expect(screen.getByText("No analytics data yet")).toBeInTheDocument();
    mocks.chart = { ...mocks.chart, refreshing: true };
    view.rerender(<Analytics />);
    expect(screen.getByText("No analytics data yet")).toBeInTheDocument();
    expect(view.container.querySelector('[data-loading-contract="chart"]')).not.toBeInTheDocument();
  });
});
