import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { APP_ICONS } from "@/config/iconography";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface ReadingVelocityData {
  date: string;
  pagesPerHour: number;
}

interface ReadingVelocityChartProps {
  data: ReadingVelocityData[];
}

export const ReadingVelocityChart = ({ data }: ReadingVelocityChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => item.date), [data]);
  const averagePace = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((sum, item) => sum + item.pagesPerHour, 0) / data.length;
  }, [data]);
  const series = useMemo(
    () => [{ name: "Pages per hour", data: data.map((item) => item.pagesPerHour) }],
    [data]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "line",
      },
      colors: [colors.chart[0]],
      markers: {
        size: 4,
        strokeColors: colors.card,
        strokeWidth: 2,
        hover: { size: 6 },
      },
      stroke: {
        curve: "smooth",
        lineCap: "round",
        width: 3,
      },
      tooltip: {
        ...baseOptions.tooltip,
        y: {
          formatter: (value) => `${Number(value).toFixed(1)} pages/hour`,
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        categories,
        tickAmount: Math.min(categories.length, 6),
      },
      yaxis: {
        ...baseOptions.yaxis,
        labels: {
          style: { colors: colors.mutedForeground },
          formatter: (value) => `${Number(value).toFixed(0)}`,
        },
      },
      annotations: averagePace > 0
        ? {
            yaxis: [
              {
                y: averagePace,
                borderColor: colors.border,
                strokeDashArray: 5,
                label: {
                  text: "Average",
                  borderColor: colors.border,
                  style: {
                    background: colors.popover,
                    color: colors.popoverForeground,
                  },
                },
              },
            ],
          }
        : undefined,
    }),
    [averagePace, baseOptions, categories, colors]
  );

  if (!data || data.length === 0) return null;

  return (
    <ApexChartCard
      title="Reading Velocity"
      subtitle={`Average ${averagePace.toFixed(1)} pages/hour`}
      icon={<APP_ICONS.stats.pace className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`reading-velocity-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="line"
        height={320}
        minWidth={480}
      />
    </ApexChartCard>
  );
};
