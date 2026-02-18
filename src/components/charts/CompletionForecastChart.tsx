import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts";
import { Calendar } from "iconoir-react";

interface CompletionForecast {
  date: string;
  predicted_page: number;
  actual_page?: number;
}

interface CompletionForecastChartProps {
  data: CompletionForecast[];
  totalPages: number;
}

const chartConfig = {
  actual: {
    label: "Actual Progress",
    color: "hsl(var(--chart-1))",
  },
  predicted: {
    label: "Predicted Progress",
    color: "hsl(var(--chart-3))",
  },
};

export const CompletionForecastChart = ({ data, totalPages }: CompletionForecastChartProps) => {
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    actual: item.actual_page,
    predicted: item.predicted_page
  }));

  const completionDate = data.find(d => d.predicted_page >= totalPages);
  const completionDateStr = completionDate 
    ? new Date(completionDate.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : "Unknown";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center justify-between">
          <span className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Completion Forecast
          </span>
          <span className="font-sans text-sm font-normal text-muted-foreground">
            Est: {completionDateStr}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="font-sans">No forecast data available yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px]">
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
                  domain={[0, totalPages]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine 
                  y={totalPages} 
                  stroke="hsl(var(--primary))" 
                  strokeDasharray="3 3"
                  label={{ value: 'Target', position: 'right', fill: 'hsl(var(--primary))', style: { fontFamily: 'Inter, system-ui, sans-serif' } }}
                />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
                  name="Actual"
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "hsl(var(--chart-3))", r: 3 }}
                  name="Predicted"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
