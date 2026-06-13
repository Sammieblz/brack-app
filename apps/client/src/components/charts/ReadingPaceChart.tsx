import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { DashboardSpeed } from "iconoir-react";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface PaceData {
  period: string;
  yourPace: number;
  averagePace: number;
}

interface ReadingPaceChartProps {
  data: PaceData[];
}

export const ReadingPaceChart = ({ data }: ReadingPaceChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => item.period), [data]);
  const series = useMemo(
    () => [
      { name: "Average", data: data.map((item) => Number(item.averagePace.toFixed(1))) },
      { name: "Your Pace", data: data.map((item) => Number(item.yourPace.toFixed(1))) },
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
      colors: [colors.mutedForeground, colors.chart[0]],
      fill: { opacity: [0.3, 0.95] },
      legend: {
        ...baseOptions.legend,
        position: "top",
        horizontalAlign: "left",
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: "46%",
        },
      },
      tooltip: {
        ...baseOptions.tooltip,
        shared: true,
        y: {
          formatter: (value) => `${Number(value).toFixed(1)} pages/hour`,
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        categories,
      },
      yaxis: {
        ...baseOptions.yaxis,
        labels: {
          style: { colors: colors.mutedForeground },
          formatter: (value) => `${Math.round(value)}`,
        },
        title: {
          text: "Pages/hour",
          style: { color: colors.mutedForeground },
        },
      },
      responsive: [
        {
          breakpoint: 640,
          options: {
            legend: { position: "bottom" },
            yaxis: { title: { text: undefined } },
          },
        },
      ],
    }),
    [baseOptions, categories, colors]
  );

  if (!data || data.length === 0) return null;

  return (
    <ApexChartCard
      title="Reading Pace Comparison"
      subtitle="Your pace against Brack's baseline"
      icon={<DashboardSpeed className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`reading-pace-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="bar"
        height={320}
      />
    </ApexChartCard>
  );
};

