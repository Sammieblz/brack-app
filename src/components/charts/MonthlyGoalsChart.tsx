import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, defs, linearGradient, stop } from "recharts";
import { Target } from "lucide-react";

interface MonthlyGoalData {
  month: string;
  goal: number;
  actual: number;
}

interface MonthlyGoalsChartProps {
  data: MonthlyGoalData[];
}

const chartConfig = {
  goal: {
    label: "Goal",
    color: "hsl(var(--muted-foreground))",
  },
  actual: {
    label: "Actual",
    color: "hsl(var(--chart-1))",
  },
};

export const MonthlyGoalsChart = ({ data }: MonthlyGoalsChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <Target className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Monthly Goals vs Actual
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 5, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorGoal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
            <XAxis 
              dataKey="month" 
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
                  const data = payload[0].payload as MonthlyGoalData;
                  const percentage = data.goal > 0 ? ((data.actual / data.goal) * 100).toFixed(1) : '0';
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">{data.month}</div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
                          <span className="text-sm">Actual: <span className="font-bold">{data.actual}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
                          <span className="text-sm">Goal: <span className="font-bold">{data.goal}</span></span>
                        </div>
                        <div className="text-xs text-muted-foreground pt-1">
                          {percentage}% of goal
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
              cursor={{ fill: "hsl(var(--chart-1) / 0.1)" }}
            />
            <Bar 
              dataKey="goal" 
              fill="url(#colorGoal)"
              radius={[6, 6, 0, 0]}
              animationDuration={750}
            />
            <Bar 
              dataKey="actual" 
              fill="url(#colorActual)"
              radius={[6, 6, 0, 0]}
              animationDuration={750}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
