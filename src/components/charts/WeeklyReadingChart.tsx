import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, defs, linearGradient, stop } from "recharts";
import { Calendar } from "lucide-react";
import type { WeeklyReadingData } from "@/hooks/useChartData";

interface WeeklyReadingChartProps {
  data: WeeklyReadingData[];
}

const chartConfig = {
  minutes: {
    label: "Reading Time (minutes)",
    color: "hsl(var(--chart-3))",
  },
};

export const WeeklyReadingChart = ({ data }: WeeklyReadingChartProps) => {
  const maxMinutes = Math.max(...data.map(d => d.minutes), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <Calendar className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          This Week's Reading Time
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 5, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
            <XAxis 
              dataKey="day" 
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
                  const hours = Math.floor(value / 60);
                  const minutes = value % 60;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <div className="space-y-1">
                        <div className="font-sans font-semibold text-sm">{payload[0].payload.day}</div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-3))]" />
                          <div className="flex items-baseline gap-1">
                            <span className="font-sans text-lg font-bold">{value}</span>
                            <span className="font-sans text-xs text-muted-foreground">min</span>
                          </div>
                        </div>
                        {hours > 0 && (
                          <div className="font-sans text-xs text-muted-foreground">
                            ({hours}h {minutes}m)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
              cursor={{ fill: "hsl(var(--chart-3) / 0.1)" }}
            />
            <Bar 
              dataKey="minutes" 
              fill="url(#colorMinutes)"
              radius={[6, 6, 0, 0]}
              animationDuration={750}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};