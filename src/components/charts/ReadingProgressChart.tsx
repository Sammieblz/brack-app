import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, defs, linearGradient, stop } from "recharts";
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
        <CardTitle className="flex items-center text-base md:text-lg">
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Reading Progress (Last 14 Days)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorBooks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => {
                // Format date to show day/month
                const date = new Date(value);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              width={35}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "5 5" }}
            />
            <Area
              type="monotone"
              dataKey="minutes"
              stackId="1"
              stroke="hsl(var(--chart-2))"
              fill="url(#colorMinutes)"
              strokeWidth={2}
              animationDuration={750}
            />
            <Area
              type="monotone"
              dataKey="books"
              stackId="2"
              stroke="hsl(var(--chart-1))"
              fill="url(#colorBooks)"
              strokeWidth={2}
              animationDuration={750}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};