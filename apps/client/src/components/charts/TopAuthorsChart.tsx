import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { UserCircle } from "iconoir-react";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { useApexTheme } from "./apexTheme";

interface AuthorData {
  author: string;
  count: number;
  color: string;
}

interface TopAuthorsChartProps {
  data: AuthorData[];
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const TopAuthorsChart = ({ data }: TopAuthorsChartProps) => {
  const { baseOptions, colors, currentTheme, resolvedTheme } = useApexTheme();

  const totalBooks = useMemo(
    () => data.reduce((sum, item) => sum + item.count, 0),
    [data]
  );
  const labels = useMemo(() => data.map((item) => item.author), [data]);
  const series = useMemo(() => data.map((item) => item.count), [data]);
  const topAuthor = data[0];

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
                fontSize: "22px",
                fontWeight: 700,
                formatter: () => getInitials(topAuthor?.author || "NA"),
              },
              total: {
                show: true,
                label: topAuthor?.author || "Top author",
                color: colors.mutedForeground,
                fontFamily: "Inter, system-ui, sans-serif",
                formatter: () => `${totalBooks} books`,
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
    [baseOptions, colors, data, labels, topAuthor?.author, totalBooks]
  );

  if (!data || data.length === 0) return null;

  return (
    <ApexChartCard
      title="Top Authors"
      subtitle={topAuthor ? `${topAuthor.author} leads your shelf` : undefined}
      icon={<UserCircle className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={`top-authors-${currentTheme}-${resolvedTheme}`}
        options={options}
        series={series}
        type="donut"
        height={320}
      />
    </ApexChartCard>
  );
};

