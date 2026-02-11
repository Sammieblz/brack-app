import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, defs, linearGradient, stop } from "recharts";
import { Filter } from "lucide-react";

interface FunnelData {
  status: string;
  count: number;
  percentage: number;
}

interface StatusFunnelChartProps {
  data: FunnelData[];
}

const chartConfig = {
  count: {
    label: "Books",
    color: "hsl(var(--chart-1))",
  },
};

const statusColors: { [key: string]: string } = {
  'to_read': 'hsl(var(--chart-1))',
  'reading': 'hsl(var(--chart-2))',
  'completed': 'hsl(var(--chart-3))',
};

export const StatusFunnelChart = ({ data }: StatusFunnelChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <Filter className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Book Status Funnel
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 60, bottom: 5 }}>
            <defs>
              {data.map((item, index) => (
                <linearGradient key={`gradient-${index}`} id={`color${item.status}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={statusColors[item.status] || 'hsl(var(--chart-1))'} stopOpacity={1} />
                  <stop offset="100%" stopColor={statusColors[item.status] || 'hsl(var(--chart-1))'} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
            <XAxis 
              type="number"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              type="category"
              dataKey="status" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              width={50}
              tickFormatter={(value) => {
                const labels: { [key: string]: string } = {
                  'to_read': 'To Read',
                  'reading': 'Reading',
                  'completed': 'Completed',
                };
                return labels[value] || value;
              }}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as FunnelData;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <div className="space-y-1">
                        <div className="font-semibold text-sm capitalize">
                          {data.status.replace('_', ' ')}
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: statusColors[data.status] || 'hsl(var(--chart-1))' }}
                          />
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold">{data.count}</span>
                            <span className="text-xs text-muted-foreground">books</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {data.percentage.toFixed(1)}% of total
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
              dataKey="count" 
              radius={[0, 6, 6, 0]}
              animationDuration={750}
            >
              {data.map((item, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={`url(#color${item.status})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
