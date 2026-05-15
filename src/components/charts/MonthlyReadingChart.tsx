import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { Reports } from "iconoir-react";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { formatChartMinutes, useApexTheme } from "./apexTheme";

interface MonthlyData {
  month: string;
  books_completed: number;
  total_reading_minutes: number;
  avg_daily_minutes: number;
}

interface MonthlyReadingChartProps {
  data: MonthlyData[];
}

export const MonthlyReadingChart = ({ data }: MonthlyReadingChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(
    () =>
      data.map((item) =>
        new Date(`${item.month}-01`).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
      ),
    [data]
  );
  const totalMinutes = useMemo(
    () => data.reduce((sum, item) => sum + item.total_reading_minutes, 0),
    [data]
  );
  const series = useMemo(
    () => [
      {
        name: "Books",
        data: data.map((item) => item.books_completed),
      },
      {
        name: "Hours",
        data: data.map((item) =>
          Math.round((item.total_reading_minutes / 60) * 10) / 10
        ),
      },
    ],
    [data]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "bar",
      },
      colors: [colors.chart[0], colors.chart[1]],
      legend: {
        ...baseOptions.legend,
        position: "top",
        horizontalAlign: "left",
      },
      plotOptions: {
        bar: {
          borderRadius: 7,
          columnWidth: "48%",
        },
      },
      tooltip: {
        ...baseOptions.tooltip,
        shared: true,
      },
      xaxis: {
        ...baseOptions.xaxis,
        categories,
        labels: {
          style: { colors: colors.mutedForeground },
          rotate: -25,
        },
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
      title="Monthly Reading Statistics"
      subtitle={`${formatChartMinutes(totalMinutes)} total reading time`}
      icon={<Reports className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`monthly-reading-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="bar"
        height={320}
        minWidth={520}
      />
    </ApexChartCard>
  );
};

