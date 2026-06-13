import { Suspense, lazy, type ReactNode } from "react";
import type {
  ApexAxisChartSeries,
  ApexNonAxisChartSeries,
  ApexOptions,
} from "apexcharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ApexChart = lazy(() => import("react-apexcharts"));

type ApexChartType =
  | "area"
  | "bar"
  | "donut"
  | "heatmap"
  | "line"
  | "scatter";

interface ApexChartCardProps {
  title: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  compact?: boolean;
}

interface ApexChartFrameProps {
  options: ApexOptions;
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  type: ApexChartType;
  height: number;
  chartKey: string;
  minWidth?: number;
  fallbackLabel?: string;
  className?: string;
}

export const ApexChartCard = ({
  title,
  icon,
  subtitle,
  action,
  children,
  className,
  contentClassName,
  compact = false,
}: ApexChartCardProps) => {
  return (
    <Card className={className}>
      <CardHeader className={cn(compact && "pb-2")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center text-base md:text-lg">
              {icon && <span className="mr-2 shrink-0">{icon}</span>}
              <span className="min-w-0 truncate">{title}</span>
            </CardTitle>
            {subtitle && (
              <p className="font-sans mt-1 text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className={cn("px-2 sm:px-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
};

export const ApexChartFrame = ({
  options,
  series,
  type,
  height,
  chartKey,
  minWidth,
  fallbackLabel = "Loading chart...",
  className,
}: ApexChartFrameProps) => {
  return (
    <div className={cn("native-scroll overflow-x-auto overflow-y-hidden", className)}>
      <div style={minWidth ? { minWidth } : undefined}>
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center rounded-md bg-muted/35 font-sans text-sm text-muted-foreground"
              style={{ height }}
            >
              {fallbackLabel}
            </div>
          }
        >
          <ApexChart
            key={chartKey}
            options={options}
            series={series}
            type={type}
            height={height}
            width="100%"
          />
        </Suspense>
      </div>
    </div>
  );
};

export const ApexEmptyState = ({ message }: { message: string }) => (
  <div className="flex min-h-[12rem] items-center justify-center rounded-md bg-muted/25 px-4 py-8 text-center font-sans text-sm text-muted-foreground">
    {message}
  </div>
);

