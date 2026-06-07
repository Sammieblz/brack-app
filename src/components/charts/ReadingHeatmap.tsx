import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { ApexChartCard, ApexChartFrame } from "./ApexChartCard";
import { formatChartMinutes, useApexTheme } from "./apexTheme";

interface HeatmapData {
  date: string;
  value: number;
}

interface ReadingHeatmapProps {
  data: HeatmapData[];
  title?: string;
  subtitle?: string;
  weeks?: number;
  compact?: boolean;
  className?: string;
}

type HeatmapPoint = {
  x: string;
  y: number;
  date: string;
  label: string;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const formatTooltipDate = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const ReadingHeatmap = ({
  data,
  title = "Reading Activity Heatmap",
  subtitle = "Daily reading minutes across recent weeks",
  weeks = 12,
  compact = false,
  className,
}: ReadingHeatmapProps) => {
  const { baseOptions, colors, currentTheme, mode, resolvedTheme, themeRevision } = useApexTheme();

  const { series, maxValue, totalMinutes } = useMemo(() => {
    const valueByDate = new Map(data.map((item) => [item.date, item.value]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());

    const startDate = new Date(currentWeekStart);
    startDate.setDate(currentWeekStart.getDate() - (weeks - 1) * 7);

    const nextSeries = DAY_LABELS.map((dayLabel, dayIndex) => {
      const points: HeatmapPoint[] = [];

      for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
        const date = new Date(startDate.getTime() + (weekIndex * 7 + dayIndex) * MS_PER_DAY);
        const dateKey = toDateKey(date);
        const isFuture = date > today;
        const value = isFuture ? 0 : valueByDate.get(dateKey) ?? 0;

        points.push({
          x: formatDateLabel(new Date(startDate.getTime() + weekIndex * 7 * MS_PER_DAY)),
          y: value,
          date: dateKey,
          label: formatDateLabel(date),
        });
      }

      return {
        name: dayLabel,
        data: points,
      };
    });

    return {
      series: nextSeries,
      maxValue: Math.max(...data.map((item) => item.value), 1),
      totalMinutes: data.reduce((sum, item) => sum + item.value, 0),
    };
  }, [data, weeks]);

  const options = useMemo<ApexOptions>(() => {
    const low = Math.max(1, Math.ceil(maxValue * 0.25));
    const medium = Math.max(low + 1, Math.ceil(maxValue * 0.5));
    const high = Math.max(medium + 1, Math.ceil(maxValue * 0.75));
    const isDark = mode === "dark";
    const emptyCellColor = isDark ? colors.backgroundSoft : colors.mutedFaint;
    const subtleCellColor = isDark ? colors.primarySoft : colors.chart[0];

    return {
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        id: `reading-heatmap-${currentTheme}-${resolvedTheme}-${themeRevision}`,
        redrawOnParentResize: true,
        redrawOnWindowResize: true,
        type: "heatmap",
      },
      dataLabels: {
        enabled: false,
      },
      grid: {
        show: false,
        padding: {
          top: 4,
          right: 10,
          bottom: 10,
          left: compact ? 18 : 26,
        },
      },
      legend: {
        ...baseOptions.legend,
        show: true,
        position: "bottom",
        horizontalAlign: "center",
        fontSize: "11px",
        itemMargin: {
          horizontal: 8,
          vertical: 2,
        },
      },
      plotOptions: {
        heatmap: {
          radius: isDark ? 4 : 5,
          enableShades: false,
          colorScale: {
            ranges: [
              {
                from: 0,
                to: 0,
                name: "None",
                color: emptyCellColor,
                foreColor: colors.mutedForeground,
              },
              {
                from: 1,
                to: low,
                name: "Light",
                color: subtleCellColor,
              },
              {
                from: low + 1,
                to: medium,
                name: "Steady",
                color: colors.chart[1],
              },
              {
                from: medium + 1,
                to: high,
                name: "Strong",
                color: colors.chart[2],
              },
              {
                from: high + 1,
                to: Math.max(high + 1, maxValue),
                name: "Deep",
                color: colors.primary,
              },
            ],
          },
        },
      },
      stroke: {
        width: 0,
        colors: ["transparent"],
      },
      tooltip: {
        ...baseOptions.tooltip,
        custom: ({ seriesIndex, dataPointIndex }) => {
          const point = series[seriesIndex]?.data[dataPointIndex] as HeatmapPoint | undefined;
          if (!point) return "";

          return `
            <div style="border: 1px solid ${colors.border}; border-radius: 0.375rem; background: ${colors.popover}; color: ${colors.popoverForeground}; padding: 0.5rem 0.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.14);">
              <div style="font-family: Inter, system-ui, sans-serif; font-size: 0.75rem; font-weight: 600;">${formatTooltipDate(point.date)}</div>
              <div style="font-family: Inter, system-ui, sans-serif; font-size: 0.875rem; font-weight: 700;">${formatChartMinutes(point.y)}</div>
            </div>
          `;
        },
      },
      xaxis: {
        type: "category",
        labels: {
          rotate: 0,
          trim: false,
          hideOverlappingLabels: false,
          style: {
            colors: colors.mutedForeground,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "11px",
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          align: "right",
          minWidth: compact ? 48 : 58,
          maxWidth: compact ? 56 : 68,
          offsetX: 0,
          style: {
            colors: colors.mutedForeground,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "11px",
          },
        },
      },
      states: {
        hover: {
          filter: {
            type: "lighten",
            value: isDark ? 0.05 : 0.08,
          },
        },
        active: {
          filter: {
            type: "none",
          },
        },
      },
    };
  }, [
    baseOptions,
    colors,
    compact,
    currentTheme,
    maxValue,
    mode,
    resolvedTheme,
    series,
    themeRevision,
  ]);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <ApexChartCard
      className={className}
      compact={compact}
      title={title}
      subtitle={!compact ? `${subtitle} - ${formatChartMinutes(totalMinutes)} total` : undefined}
      icon={<APP_ICONS.dashboard.today className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
    >
      <ApexChartFrame
        chartKey={[
          "reading-heatmap",
          currentTheme,
          resolvedTheme,
          mode,
          themeRevision,
          colors.background,
          colors.card,
          colors.primary,
          colors.muted,
          weeks,
          compact ? "compact" : "full",
          data.length,
          totalMinutes,
        ].join("|")}
        options={options}
        series={series}
        type="heatmap"
        height={compact ? 276 : 356}
        minWidth={compact ? 620 : 760}
        fallbackLabel="Loading heatmap..."
        className={cn(compact && "md:overflow-x-visible")}
      />
    </ApexChartCard>
  );
};
