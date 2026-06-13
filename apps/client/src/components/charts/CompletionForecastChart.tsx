import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { CalendarCheck } from "iconoir-react";
import { ApexChartCard, ApexChartFrame, ApexEmptyState } from "./ApexChartCard";
import { formatShortDate, useApexTheme } from "./apexTheme";

interface CompletionForecast {
  date: string;
  predicted_page: number;
  actual_page?: number;
}

interface CompletionForecastChartProps {
  data: CompletionForecast[];
  totalPages: number;
}

export const CompletionForecastChart = ({
  data,
  totalPages,
}: CompletionForecastChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(
    () => data.map((item) => formatShortDate(item.date)),
    [data]
  );
  const completionDate = data.find((item) => item.predicted_page >= totalPages);
  const completionLabel = completionDate
    ? new Date(completionDate.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  const series = useMemo(
    () => [
      {
        name: "Actual",
        data: data.map((item) =>
          typeof item.actual_page === "number" ? item.actual_page : null
        ),
      },
      {
        name: "Predicted",
        data: data.map((item) => item.predicted_page),
      },
    ],
    [data]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "line",
      },
      colors: [colors.chart[0], colors.chart[2]],
      markers: {
        size: [4, 2],
        strokeColors: colors.card,
        strokeWidth: 2,
      },
      stroke: {
        curve: "smooth",
        lineCap: "round",
        width: [3, 2],
        dashArray: [0, 6],
      },
      legend: {
        ...baseOptions.legend,
        position: "top",
        horizontalAlign: "left",
      },
      tooltip: {
        ...baseOptions.tooltip,
        shared: true,
        y: {
          formatter: (value) =>
            value === null || typeof value === "undefined"
              ? "No logged page"
              : `${Math.round(Number(value))} pages`,
        },
      },
      annotations: {
        yaxis: [
          {
            y: totalPages,
            borderColor: colors.primary,
            strokeDashArray: 5,
            label: {
              text: "Target",
              borderColor: colors.primary,
              style: {
                background: colors.popover,
                color: colors.popoverForeground,
              },
            },
          },
        ],
      },
      xaxis: {
        ...baseOptions.xaxis,
        categories,
        tickAmount: Math.min(categories.length, 6),
      },
      yaxis: {
        ...baseOptions.yaxis,
        min: 0,
        max: Math.max(totalPages, ...data.map((item) => item.predicted_page)),
        labels: {
          style: { colors: colors.mutedForeground },
          formatter: (value) => `${Math.round(value)}`,
        },
      },
    }),
    [baseOptions, categories, colors, data, totalPages]
  );

  return (
    <ApexChartCard
      title="Completion Forecast"
      subtitle={`Estimated finish: ${completionLabel}`}
      icon={<CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      {data.length === 0 ? (
        <ApexEmptyState message="No forecast data available yet" />
      ) : (
        <ApexChartFrame
          chartKey={`completion-forecast-${currentTheme}-${resolvedTheme}`}
          options={options}
          series={series}
          type="line"
          height={300}
          minWidth={520}
        />
      )}
    </ApexChartCard>
  );
};

