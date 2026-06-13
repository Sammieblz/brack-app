import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { APP_ICONS } from "@/config/iconography";
import type { ReadingProgressData } from "@/hooks/useChartData";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { formatChartMinutes, useApexTheme } from "./apexTheme";

interface ReadingProgressChartProps {
  data: ReadingProgressData[];
}

export const ReadingProgressChart = ({ data }: ReadingProgressChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => item.date), [data]);
  const totalMinutes = useMemo(
    () => data.reduce((sum, item) => sum + item.minutes, 0),
    [data]
  );

  const series = useMemo(
    () => [
      {
        name: "Reading Time",
        type: "area",
        data: data.map((item) => item.minutes),
      },
      {
        name: "Books Completed",
        type: "line",
        data: data.map((item) => item.books),
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
        stacked: false,
      },
      colors: [colors.chart[1], colors.chart[0]],
      fill: {
        type: ["gradient", "solid"],
        gradient: {
          shadeIntensity: 0.75,
          opacityFrom: 0.42,
          opacityTo: 0.06,
          stops: [0, 90, 100],
        },
      },
      labels: categories,
      legend: {
        ...baseOptions.legend,
        position: "top",
        horizontalAlign: "left",
      },
      stroke: {
        curve: "smooth",
        lineCap: "round",
        width: [3, 3],
      },
      tooltip: {
        ...baseOptions.tooltip,
        y: [
          {
            formatter: (value) => formatChartMinutes(Number(value)),
            title: { formatter: () => "Time" },
          },
          {
            formatter: (value) => `${Number(value)} books`,
            title: { formatter: () => "Completed" },
          },
        ],
      },
      xaxis: {
        ...baseOptions.xaxis,
        categories,
        tickAmount: Math.min(categories.length, 7),
      },
      yaxis: [
        {
          labels: {
            style: { colors: colors.mutedForeground },
            formatter: (value) => `${Math.round(value)}`,
          },
          title: {
            text: "Minutes",
            style: { color: colors.mutedForeground },
          },
        },
        {
          opposite: true,
          labels: {
            style: { colors: colors.mutedForeground },
            formatter: (value) => `${Math.round(value)}`,
          },
          title: {
            text: "Books",
            style: { color: colors.mutedForeground },
          },
        },
      ],
      responsive: [
        {
          breakpoint: 640,
          options: {
            legend: { show: false },
            yaxis: [
              { labels: { show: true }, title: { text: undefined } },
              { labels: { show: false }, title: { text: undefined } },
            ],
          },
        },
      ],
    }),
    [baseOptions, categories, colors]
  );

  return (
    <ApexChartCard
      title="Reading Progress"
      subtitle={`Last 14 days - ${formatChartMinutes(totalMinutes)} tracked`}
      icon={<APP_ICONS.bookDetail.detailedAnalytics className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`reading-progress-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="line"
        height={320}
        minWidth={520}
      />
    </ApexChartCard>
  );
};

