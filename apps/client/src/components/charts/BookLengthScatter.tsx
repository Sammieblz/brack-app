import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { APP_ICONS } from "@/config/iconography";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface ScatterData {
  pages: number;
  completionDays: number;
  title: string;
}

interface BookLengthScatterProps {
  data: ScatterData[];
}

export const BookLengthScatter = ({ data }: BookLengthScatterProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const series = useMemo(
    () => [
      {
        name: "Books",
        data: data.map((item) => ({
          x: item.pages,
          y: item.completionDays,
          title: item.title,
        })),
      },
    ],
    [data]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "scatter",
      },
      colors: [colors.chart[2]],
      markers: {
        size: 6,
        strokeColors: colors.card,
        strokeWidth: 2,
        hover: { size: 8 },
      },
      tooltip: {
        ...baseOptions.tooltip,
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const point = w.config.series?.[seriesIndex]?.data?.[dataPointIndex] as
            | { x: number; y: number; title?: string }
            | undefined;
          if (!point) return "";

          return `
            <div class="apexcharts-tooltip-title">${point.title || "Book"}</div>
            <div style="padding: 8px 10px;">
              <div><strong>${point.x}</strong> pages</div>
              <div style="color:${colors.mutedForeground};">${point.y} days to complete</div>
            </div>
          `;
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        type: "numeric",
        title: {
          text: "Pages",
          style: { color: colors.mutedForeground },
        },
        labels: {
          style: { colors: colors.mutedForeground },
          formatter: (value) => `${Math.round(Number(value))}`,
        },
      },
      yaxis: {
        ...baseOptions.yaxis,
        title: {
          text: "Days",
          style: { color: colors.mutedForeground },
        },
        labels: {
          style: { colors: colors.mutedForeground },
          formatter: (value) => `${Math.round(value)}`,
        },
      },
      responsive: [
        {
          breakpoint: 640,
          options: {
            xaxis: { title: { text: undefined } },
            yaxis: { title: { text: undefined } },
          },
        },
      ],
    }),
    [baseOptions, colors]
  );

  if (!data || data.length === 0) return null;

  return (
    <ApexChartCard
      title="Book Length vs Completion"
      subtitle="How page count affects your finish time"
      icon={<APP_ICONS.stats.longestBook className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`book-length-scatter-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="scatter"
        height={320}
        minWidth={500}
      />
    </ApexChartCard>
  );
};

