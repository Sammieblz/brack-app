import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { FireFlame } from "iconoir-react";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface StreakTimelineData {
  date: string;
  streak: number;
}

interface StreaksTimelineChartProps {
  data: StreakTimelineData[];
}

export const StreaksTimelineChart = ({ data }: StreaksTimelineChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => item.date), [data]);
  const bestStreak = useMemo(
    () => Math.max(...data.map((item) => item.streak), 0),
    [data]
  );
  const series = useMemo(
    () => [{ name: "Streak", data: data.map((item) => item.streak) }],
    [data]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "area",
      },
      colors: [colors.chart[3]],
      fill: {
        type: "gradient",
        gradient: {
          opacityFrom: 0.42,
          opacityTo: 0.06,
          shadeIntensity: 0.75,
        },
      },
      markers: {
        size: 3,
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
          formatter: (value) => `${Math.round(Number(value))} days`,
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
          formatter: (value) => `${Math.round(value)}`,
        },
      },
    }),
    [baseOptions, categories, colors]
  );

  if (!data || data.length === 0) return null;

  return (
    <ApexChartCard
      title="Streak Timeline"
      subtitle={`Best streak in this range: ${bestStreak} days`}
      icon={<FireFlame className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`streak-timeline-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="area"
        height={320}
        minWidth={480}
      />
    </ApexChartCard>
  );
};

