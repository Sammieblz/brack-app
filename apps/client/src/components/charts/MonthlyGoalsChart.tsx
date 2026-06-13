import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { APP_ICONS } from "@/config/iconography";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface MonthlyGoalData {
  month: string;
  goal: number;
  actual: number;
}

interface MonthlyGoalsChartProps {
  data: MonthlyGoalData[];
}

export const MonthlyGoalsChart = ({ data }: MonthlyGoalsChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const categories = useMemo(() => data.map((item) => item.month), [data]);
  const latest = data[data.length - 1];
  const series = useMemo(
    () => [
      { name: "Goal", data: data.map((item) => item.goal) },
      { name: "Actual", data: data.map((item) => item.actual) },
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
      fill: {
        opacity: [0.32, 0.95],
      },
      legend: {
        ...baseOptions.legend,
        position: "top",
        horizontalAlign: "left",
      },
      plotOptions: {
        bar: {
          borderRadius: 7,
          columnWidth: "48%",
        },
      },
      tooltip: {
        ...baseOptions.tooltip,
        shared: true,
        y: {
          formatter: (value) => `${Math.round(Number(value))} books`,
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        categories,
        labels: {
          style: { colors: colors.mutedForeground },
          rotate: -25,
        },
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
      title="Monthly Goals vs Actual"
      subtitle={latest ? `${latest.actual} of ${latest.goal} books this month` : undefined}
      icon={<APP_ICONS.dashboard.goal className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`monthly-goals-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="bar"
        height={320}
        minWidth={520}
      />
    </ApexChartCard>
  );
};

