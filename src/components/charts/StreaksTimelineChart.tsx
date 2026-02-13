import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, defs, linearGradient, stop } from "recharts";
import { Flame } from "lucide-react";

interface StreakTimelineData {
  date: string;
  streak: number;
}

interface StreaksTimelineChartProps {
  data: StreakTimelineData[];
}

const chartConfig = {
  streak: {
    label: "Streak (days)",
    color: "hsl(var(--chart-4))",
  },
};

export const StreaksTimelineChart = ({ data }: StreaksTimelineChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <Flame className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Streak Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorStreak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.1} />
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
              width={35}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const value = payload[0].value as number;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <div className="space-y-1">
                        <div className="font-sans font-semibold text-sm">{payload[0].payload.date}</div>
                        <div className="font-sans flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-4))]" />
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold">{value}</span>
                            <span className="text-xs text-muted-foreground">days</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "5 5" }}
            />
            <Area
              type="monotone"
              dataKey="streak"
              stroke="hsl(var(--chart-4))"
              fill="url(#colorStreak)"
              strokeWidth={2}
              animationDuration={750}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
