import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { Clock } from "iconoir-react";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { formatChartMinutes, useApexTheme } from "./apexTheme";

interface TimeDistributionData {
  hour: string;
  minutes: number;
}

interface TimeDistributionChartProps {
  data: TimeDistributionData[];
}

const formatHour = (hour: string) => {
  const value = Number.parseInt(hour, 10);
  const suffix = value >= 12 ? "PM" : "AM";
  const display = value % 12 || 12;
  return `${display}${suffix}`;
};

export const TimeDistributionChart = ({ data }: TimeDistributionChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => formatHour(item.hour)), [data]);
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
      colors: [colors.chart[4]],
      fill: {
        type: "gradient",
        gradient: {
          opacityFrom: 0.95,
          opacityTo: 0.55,
          shadeIntensity: 0.4,
        },
      },
      legend: { show: false },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: "62%",
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
        tickAmount: 8,
        labels: {
          style: { colors: colors.mutedForeground, fontSize: "10px" },
        },
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

  if (!data || data.length === 0) return null;

  return (
    <ApexChartCard
      title="Reading Time by Hour"
      subtitle={`${formatChartMinutes(totalMinutes)} distributed across your day`}
      icon={<Clock className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`time-distribution-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="bar"
        height={320}
        minWidth={680}
      />
    </ApexChartCard>
  );
};

