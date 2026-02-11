import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, defs, linearGradient, stop } from "recharts";
import { TrendingUp } from "lucide-react";

interface ReadingVelocityData {
  date: string;
  pagesPerHour: number;
}

interface ReadingVelocityChartProps {
  data: ReadingVelocityData[];
}

const chartConfig = {
  pagesPerHour: {
    label: "Pages/Hour",
    color: "hsl(var(--chart-1))",
  },
};

export const ReadingVelocityChart = ({ data }: ReadingVelocityChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Reading Velocity Over Time
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
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
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              width={40}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "5 5" }}
            />
            <Line
              type="monotone"
              dataKey="pagesPerHour"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#colorVelocity)"
              animationDuration={750}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
