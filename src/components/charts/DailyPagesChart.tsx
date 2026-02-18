import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Book } from "iconoir-react";

interface DailyProgress {
  date: string;
  pages_read: number;
  time_spent: number;
}

interface DailyPagesChartProps {
  data: DailyProgress[];
}

const chartConfig = {
  pages: {
    label: "Pages Read",
    color: "hsl(var(--chart-2))",
  },
};

export const DailyPagesChart = ({ data }: DailyPagesChartProps) => {
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    pages: item.pages_read
  }));

  const totalPages = data.reduce((sum, d) => sum + d.pages_read, 0);
  const avgPages = data.length > 0 ? (totalPages / data.length).toFixed(1) : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center justify-between">
          <span className="flex items-center">
            <Book className="h-5 w-5 mr-2" />
            Daily Pages Read
          </span>
          <span className="font-sans text-sm font-normal text-muted-foreground">
            Avg: {avgPages} pages/day
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="font-sans">No daily progress data available yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
                <Bar 
                  dataKey="pages" 
                  fill="hsl(var(--chart-2))" 
                  radius={[4, 4, 0, 0]}
                  name="Pages"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
