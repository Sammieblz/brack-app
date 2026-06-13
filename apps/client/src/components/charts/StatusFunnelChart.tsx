import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { FilterList } from "iconoir-react";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface FunnelData {
  status: string;
  count: number;
  percentage: number;
}

interface StatusFunnelChartProps {
  data: FunnelData[];
}

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    to_read: "To Read",
    reading: "Reading",
    completed: "Completed",
  };
  return labels[status] || status.replace("_", " ");
};

export const StatusFunnelChart = ({ data }: StatusFunnelChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => statusLabel(item.status)), [data]);
  const series = useMemo(
    () => [{ name: "Books", data: data.map((item) => item.count) }],
    [data]
  );

  const statusColors = useMemo(
    () => [colors.chart[0], colors.chart[1], colors.chart[2]],
    [colors.chart]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "bar",
      },
      colors: statusColors,
      fill: {
        opacity: 0.95,
      },
      legend: { show: false },
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: true,
          borderRadius: 8,
          barHeight: "58%",
        },
      },
      tooltip: {
        ...baseOptions.tooltip,
        custom: ({ dataPointIndex }) => {
          const item = data[dataPointIndex];
          if (!item) return "";
          return `
            <div class="apexcharts-tooltip-title">${statusLabel(item.status)}</div>
            <div style="padding: 8px 10px;">
              <strong>${item.count}</strong> books
              <span style="color:${colors.mutedForeground}; margin-left: 6px;">${item.percentage.toFixed(1)}%</span>
            </div>
          `;
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        labels: {
          style: { colors: colors.mutedForeground },
          formatter: (value) => `${Math.round(Number(value))}`,
        },
      },
      yaxis: {
        labels: {
          style: { colors: categories.map(() => colors.mutedForeground) },
        },
      },
    }),
    [baseOptions, categories, colors.mutedForeground, data, statusColors]
  );

  if (!data || data.length === 0) return null;

  return (
    <ApexChartCard
      title="Book Status Flow"
      subtitle="How your library is distributed right now"
      icon={<FilterList className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`status-funnel-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="bar"
        height={260}
      />
    </ApexChartCard>
  );
};

