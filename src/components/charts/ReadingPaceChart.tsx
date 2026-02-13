import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, defs, linearGradient, stop, ReferenceLine } from "recharts";
import { Gauge } from "lucide-react";

interface PaceData {
  period: string;
  yourPace: number;
  averagePace: number;
}

interface ReadingPaceChartProps {
  data: PaceData[];
}

const chartConfig = {
  yourPace: {
    label: "Your Pace",
    color: "hsl(var(--chart-1))",
  },
  averagePace: {
    label: "Average",
    color: "hsl(var(--muted-foreground))",
  },
};

export const ReadingPaceChart = ({ data }: ReadingPaceChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <Gauge className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Reading Pace Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 5, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorYourPace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
            <XAxis 
              dataKey="period" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              width={40}
              label={{ value: 'Pages/Hour', angle: -90, position: 'insideLeft', style: { fontFamily: 'Inter, system-ui, sans-serif' } }}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as PaceData;
                  const diff = data.yourPace - data.averagePace;
                  const diffPercent = data.averagePace > 0 ? ((diff / data.averagePace) * 100).toFixed(1) : '0';
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <div className="space-y-1">
                        <div className="font-sans font-semibold text-sm">{data.period}</div>
                        <div className="font-sans flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
                          <span className="text-sm">Your pace: <span className="font-bold">{data.yourPace.toFixed(1)}</span></span>
                        </div>
                        <div className="font-sans flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
                          <span className="text-sm">Average: <span className="font-bold">{data.averagePace.toFixed(1)}</span></span>
                        </div>
                        <div className={`font-sans text-xs pt-1 ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {diff >= 0 ? '+' : ''}{diffPercent}% vs average
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
              dataKey="averagePace" 
              fill="url(#colorAverage)"
              radius={[6, 6, 0, 0]}
              animationDuration={750}
            />
            <Bar 
              dataKey="yourPace" 
              fill="url(#colorYourPace)"
              radius={[6, 6, 0, 0]}
              animationDuration={750}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
