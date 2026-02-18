import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, defs, linearGradient, stop } from "recharts";
import { Target } from "lucide-react";

interface CompletionRateData {
  genre: string;
  completionRate: number;
  total: number;
}

interface CompletionRateChartProps {
  data: CompletionRateData[];
}

const chartConfig = {
  completionRate: {
    label: "Completion Rate (%)",
    color: "hsl(var(--chart-2))",
  },
};

export const CompletionRateChart = ({ data }: CompletionRateChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <Target className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Completion Rate by Genre
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 5, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
            <XAxis 
              dataKey="genre" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              width={40}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as CompletionRateData;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <div className="space-y-1">
                        <div className="font-sans font-semibold text-sm">{data.genre}</div>
                        <div className="font-sans flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]" />
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold">{data.completionRate.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                        <div className="font-sans text-xs text-muted-foreground">
                          {data.total} books total
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
              cursor={{ fill: "hsl(var(--chart-2) / 0.1)" }}
            />
            <Bar 
              dataKey="completionRate" 
              fill="url(#colorCompletion)"
              radius={[6, 6, 0, 0]}
              animationDuration={750}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
