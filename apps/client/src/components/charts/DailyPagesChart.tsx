import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { APP_ICONS } from "@/config/iconography";
import { ApexChartCard, ApexChartFrame, ApexEmptyState } from "./ApexChartCard";
import { formatShortDate, useApexTheme } from "./apexTheme";

interface DailyProgress {
  date: string;
  pages_read: number;
  time_spent: number;
}

interface DailyPagesChartProps {
  data: DailyProgress[];
}

export const DailyPagesChart = ({ data }: DailyPagesChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(
    () => data.map((item) => formatShortDate(item.date)),
    [data]
  );
  const totalPages = useMemo(
    () => data.reduce((sum, item) => sum + item.pages_read, 0),
    [data]
  );
  const avgPages = data.length > 0 ? totalPages / data.length : 0;
  const series = useMemo(
    () => [{ name: "Pages", data: data.map((item) => item.pages_read) }],
    [data]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "bar",
      },
      colors: [colors.chart[1]],
      fill: {
        type: "gradient",
        gradient: {
          opacityFrom: 0.95,
          opacityTo: 0.58,
          shadeIntensity: 0.45,
        },
      },
      legend: { show: false },
      plotOptions: {
        bar: {
          borderRadius: 7,
          columnWidth: "52%",
        },
      },
      tooltip: {
        ...baseOptions.tooltip,
        y: {
          formatter: (value) => `${Math.round(Number(value))} pages`,
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        categories,
        tickAmount: Math.min(categories.length, 7),
      },
      yaxis: {
        ...baseOptions.yaxis,
        labels: {
          style: { colors: colors.mutedForeground },
          formatter: (value) => `${Math.round(value)}`,
        },
      },
    }),
    [baseOptions, categories, colors]
  );

  return (
    <ApexChartCard
      title="Daily Pages Read"
      subtitle={`Average ${avgPages.toFixed(1)} pages/day`}
      icon={<APP_ICONS.stats.pagesRead className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      {data.length === 0 ? (
        <ApexEmptyState message="No daily progress data available yet" />
      ) : (
        <ApexChartFrame
          chartKey={`daily-pages-${currentTheme}-${resolvedTheme}`}
          options={options}
          series={series}
          type="bar"
          height={260}
          minWidth={480}
        />
      )}
    </ApexChartCard>
  );
};

