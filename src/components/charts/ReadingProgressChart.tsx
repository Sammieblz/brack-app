import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import type { ReadingProgressData } from "@/hooks/useChartData";

interface ReadingProgressChartProps {
  data: ReadingProgressData[];
}

const chartConfig = {
  books: {
    label: "Books Completed",
    color: "hsl(var(--chart-1))",
  },
  minutes: {
    label: "Reading Time (min)",
    color: "hsl(var(--chart-2))",
  },
};

export const ReadingProgressChart = ({ data }: ReadingProgressChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Reading Progress (Last 14 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="minutes"
              stackId="1"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2) / 0.3)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="books"
              stackId="2"
              stroke="hsl(var(--chart-1))"
              fill="hsl(var(--chart-1) / 0.3)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};