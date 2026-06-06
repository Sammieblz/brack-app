import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { APP_ICONS } from "@/config/iconography";
import type { GenreData } from "@/hooks/useChartData";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface GenreDistributionChartProps {
  data: GenreData[];
}

export const GenreDistributionChart = ({ data }: GenreDistributionChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const totalBooks = useMemo(
    () => data.reduce((sum, item) => sum + item.count, 0),
    [data]
  );
  const labels = useMemo(() => data.map((item) => item.genre), [data]);
  const series = useMemo(() => data.map((item) => item.count), [data]);

  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: "donut",
      },
      colors: data.map((_, index) => colors.chart[index % colors.chart.length]),
      labels,
      legend: {
        ...baseOptions.legend,
        position: "bottom",
        horizontalAlign: "center",
      },
      plotOptions: {
        pie: {
          expandOnClick: false,
          donut: {
            size: "68%",
            labels: {
              show: true,
              name: {
                color: colors.mutedForeground,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "12px",
              },
              value: {
                color: colors.foreground,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "26px",
                fontWeight: 700,
                formatter: (value) => `${value}`,
              },
              total: {
                show: true,
                label: "Books",
                color: colors.mutedForeground,
                fontFamily: "Inter, system-ui, sans-serif",
                formatter: () => `${totalBooks}`,
              },
            },
          },
        },
      },
      stroke: {
        colors: [colors.card],
        width: 3,
      },
      tooltip: {
        ...baseOptions.tooltip,
        y: {
          formatter: (value) => {
            const share = totalBooks > 0 ? (Number(value) / totalBooks) * 100 : 0;
            return `${value} books - ${share.toFixed(1)}%`;
          },
        },
      },
      responsive: [
        {
          breakpoint: 640,
          options: {
            legend: { show: false },
            plotOptions: { pie: { donut: { size: "72%" } } },
          },
        },
      ],
    }),
    [baseOptions, colors, data, labels, totalBooks]
  );

  return (
    <ApexChartCard
      title="Books by Genre"
      subtitle={`${totalBooks} books across ${data.length} genres`}
      icon={<APP_ICONS.analytics.favoriteGenre className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`genre-distribution-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="donut"
        height={320}
      />
    </ApexChartCard>
  );
};

