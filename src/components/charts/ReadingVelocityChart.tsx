import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface VelocityData {
  date: string;
  pages_per_day: number;
  cumulative_pages: number;
}

interface ReadingVelocityChartProps {
  data: VelocityData[];
}

const chartConfig = {
  velocity: {
    label: "Pages/Day",
    color: "hsl(var(--chart-1))",
  },
};

export const ReadingVelocityChart = ({ data }: ReadingVelocityChartProps) => {
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    velocity: item.pages_per_day
  }));

  const avgVelocity = data.length > 0 
    ? (data.reduce((sum, d) => sum + d.pages_per_day, 0) / data.length).toFixed(1)
    : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Reading Velocity
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Avg: {avgVelocity} pages/day
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No velocity data available yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="velocity" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
                  name="Pages/Day"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
