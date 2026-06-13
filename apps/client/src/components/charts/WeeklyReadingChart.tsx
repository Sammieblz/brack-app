import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { CalendarCheck } from "iconoir-react";
import type { WeeklyReadingData } from "@/hooks/useChartData";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { formatChartMinutes, useApexTheme } from "./apexTheme";

interface WeeklyReadingChartProps {
  data: WeeklyReadingData[];
}

export const WeeklyReadingChart = ({ data }: WeeklyReadingChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => item.day), [data]);
  const totalMinutes = useMemo(
    () => data.reduce((sum, item) => sum + item.minutes, 0),
    [data]
  );
  const series = useMemo(
    () => [{ name: "Reading Time", data: data.map((item) => item.minutes) }],
    [data]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "bar",
      },
      colors: [colors.chart[2]],
      fill: {
        type: "gradient",
        gradient: {
          opacityFrom: 0.95,
          opacityTo: 0.58,
          shadeIntensity: 0.45,
          stops: [0, 100],
        },
      },
      legend: { show: false },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: "48%",
          distributed: false,
        },
      },
      tooltip: {
        ...baseOptions.tooltip,
        y: {
          formatter: (value) => formatChartMinutes(Number(value)),
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
          formatter: (value) => `${Math.round(value)}m`,
        },
      },
    }),
    [baseOptions, categories, colors]
  );

  return (
    <ApexChartCard
      title="This Week's Reading Time"
      subtitle={`${formatChartMinutes(totalMinutes)} across the last 7 days`}
      icon={<CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`weekly-reading-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="bar"
        height={320}
      />
    </ApexChartCard>
  );
};

