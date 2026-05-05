import { Suspense, lazy, useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ICONS } from "@/config/iconography";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const ApexChart = lazy(() => import("react-apexcharts"));

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

const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const ReadingHeatmap = ({
  data,
  title = "Reading Activity Heatmap",
  subtitle = "Daily reading minutes across recent weeks",
  weeks = 12,
  compact = false,
  className,
}: ReadingHeatmapProps) => {
  const { currentTheme, resolvedTheme } = useTheme();

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

    return {
      chart: {
        type: "heatmap",
        background: "transparent",
        toolbar: { show: false },
        animations: {
          enabled: true,
          speed: 350,
        },
        fontFamily: "Inter, system-ui, sans-serif",
        foreColor: "hsl(var(--muted-foreground))",
      },
      theme: {
        mode: resolvedTheme === "dark" ? "dark" : "light",
      },
      dataLabels: {
        enabled: false,
      },
      grid: {
        show: false,
        padding: {
          top: -8,
          right: 0,
          bottom: -6,
          left: 0,
        },
      },
      legend: {
        show: true,
        position: "bottom",
        horizontalAlign: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        labels: {
          colors: "hsl(var(--muted-foreground))",
        },
        markers: {
          width: 10,
          height: 10,
          radius: 3,
        },
      },
      plotOptions: {
        heatmap: {
          radius: 5,
          enableShades: false,
          colorScale: {
            ranges: [
              {
                from: 0,
                to: 0,
                name: "None",
                color: "hsl(var(--muted) / 0.45)",
                foreColor: "hsl(var(--muted-foreground))",
              },
              {
                from: 1,
                to: low,
                name: "Light",
                color: "hsl(var(--primary) / 0.28)",
              },
              {
                from: low + 1,
                to: medium,
                name: "Steady",
                color: "hsl(var(--primary) / 0.5)",
              },
              {
                from: medium + 1,
                to: high,
                name: "Strong",
                color: "hsl(var(--primary) / 0.72)",
              },
              {
                from: high + 1,
                to: Math.max(high + 1, maxValue),
                name: "Deep",
                color: "hsl(var(--primary))",
              },
            ],
          },
        },
      },
      stroke: {
        width: 3,
        colors: ["hsl(var(--card))"],
      },
      tooltip: {
        theme: resolvedTheme === "dark" ? "dark" : "light",
        custom: ({ seriesIndex, dataPointIndex }) => {
          const point = series[seriesIndex]?.data[dataPointIndex] as HeatmapPoint | undefined;
          if (!point) return "";

          return `
            <div style="border: 1px solid hsl(var(--border)); border-radius: 0.375rem; background: hsl(var(--popover)); color: hsl(var(--popover-foreground)); padding: 0.5rem 0.75rem; box-shadow: 0 10px 30px hsl(var(--foreground) / 0.14);">
              <div style="font-family: Inter, system-ui, sans-serif; font-size: 0.75rem; font-weight: 600;">${formatTooltipDate(point.date)}</div>
              <div style="font-family: Inter, system-ui, sans-serif; font-size: 0.875rem; font-weight: 700;">${formatMinutes(point.y)}</div>
            </div>
          `;
        },
      },
      xaxis: {
        type: "category",
        labels: {
          rotate: -35,
          trim: false,
          style: {
            colors: "hsl(var(--muted-foreground))",
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
          style: {
            colors: "hsl(var(--muted-foreground))",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "11px",
          },
        },
      },
      states: {
        hover: {
          filter: {
            type: "lighten",
            value: 0.08,
          },
        },
        active: {
          filter: {
            type: "none",
          },
        },
      },
    };
  }, [maxValue, resolvedTheme, series]);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className={cn(compact && "pb-2")}>
        <CardTitle className="flex items-center text-base md:text-lg">
          <APP_ICONS.dashboard.today className="mr-2 h-4 w-4 md:h-5 md:w-5" />
          {title}
        </CardTitle>
        {!compact && (
          <p className="font-sans text-sm text-muted-foreground">
            {subtitle} - {formatMinutes(totalMinutes)} total
          </p>
        )}
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="native-scroll overflow-x-auto">
          <div className="min-w-[44rem] md:min-w-0">
            <Suspense
              fallback={
                <div
                  className={cn(
                    "flex items-center justify-center rounded-md bg-muted/35 text-sm text-muted-foreground",
                    compact ? "h-[260px]" : "h-[340px]"
                  )}
                >
                  Loading heatmap...
                </div>
              }
            >
              <ApexChart
                key={`${currentTheme}-${resolvedTheme}-${weeks}-${compact ? "compact" : "full"}`}
                options={options}
                series={series}
                type="heatmap"
                height={compact ? 260 : 340}
                width="100%"
              />
            </Suspense>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
