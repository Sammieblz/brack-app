import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

interface MonthlyData {
  month: string;
  books_completed: number;
  total_reading_minutes: number;
  avg_daily_minutes: number;
}

interface MonthlyReadingChartProps {
  data: MonthlyData[];
}

const chartConfig = {
  books: {
    label: "Books Completed",
    color: "hsl(var(--chart-1))",
  },
  hours: {
    label: "Reading Hours",
    color: "hsl(var(--chart-2))",
  },
};

export const MonthlyReadingChart = ({ data }: MonthlyReadingChartProps) => {
  // Transform data for display
  const chartData = data.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    books: item.books_completed,
    hours: Math.round((item.total_reading_minutes / 60) * 10) / 10,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Reading Statistics</CardTitle>
        <CardDescription>Books completed and reading time per month</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                fontSize={12}
                className="text-muted-foreground"
              />
              <YAxis 
                fontSize={12}
                className="text-muted-foreground"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar 
                dataKey="books" 
                fill="var(--color-books)" 
                name="Books"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="hours" 
                fill="var(--color-hours)" 
                name="Hours"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
