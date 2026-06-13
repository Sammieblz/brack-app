import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { APP_ICONS } from "@/config/iconography";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface CompletionRateData {
  genre: string;
  completionRate: number;
  total: number;
}

interface CompletionRateChartProps {
  data: CompletionRateData[];
}

export const CompletionRateChart = ({ data }: CompletionRateChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => item.genre), [data]);
  const series = useMemo(
    () => [
      {
        name: "Completion Rate",
        data: data.map((item) => Number(item.completionRate.toFixed(1))),
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
          borderRadius: 8,
          columnWidth: "54%",
        },
      },
      tooltip: {
        ...baseOptions.tooltip,
        custom: ({ dataPointIndex }) => {
          const item = data[dataPointIndex];
          if (!item) return "";
          return `
            <div class="apexcharts-tooltip-title">${item.genre}</div>
            <div style="padding: 8px 10px;">
              <strong>${item.completionRate.toFixed(1)}%</strong>
              <span style="color:${colors.mutedForeground}; margin-left: 6px;">${item.total} books</span>
            </div>
          `;
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        categories,
        labels: {
          ...baseOptions.xaxis?.labels,
          rotate: -35,
          hideOverlappingLabels: true,
          trim: true,
          style: { colors: colors.mutedForeground, fontSize: "11px" },
        },
      },
      yaxis: {
        ...baseOptions.yaxis,
        max: 100,
        labels: {
          style: { colors: colors.mutedForeground },
          formatter: (value) => `${Math.round(value)}%`,
        },
      },
      responsive: [
        {
          breakpoint: 640,
          options: {
            plotOptions: { bar: { columnWidth: "64%" } },
            xaxis: { labels: { rotate: -45 } },
          },
        },
      ],
    }),
    [baseOptions, categories, colors, data]
  );

  if (!data || data.length === 0) return null;

  return (
    <ApexChartCard
      title="Completion Rate by Genre"
      subtitle="Which genres you finish most often"
      icon={<APP_ICONS.analytics.completed className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`completion-rate-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="bar"
        height={320}
        minWidth={520}
      />
    </ApexChartCard>
  );
};

