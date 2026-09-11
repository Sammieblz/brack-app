import { ApexChartCard } from "@/components/charts/ApexChartCard";
import { Skeleton } from "@/components/ui/skeleton";

export const ChartSkeleton = ({ height = 320 }: { height?: number }) => {
  return (
    <div data-loading-contract="chart" aria-hidden="true">
      <ApexChartCard
        title={
          <Skeleton
            className="h-[1lh] w-48 max-w-full"
            style={{ fontSize: "inherit", lineHeight: "inherit" }}
          />
        }
        subtitle={
          <Skeleton
            className="h-[1lh] w-64 max-w-full"
            style={{ fontSize: "inherit", lineHeight: "inherit" }}
          />
        }
      >
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      </ApexChartCard>
    </div>
  );
};
