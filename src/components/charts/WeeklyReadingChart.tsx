import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar 
              dataKey="minutes" 
              fill="hsl(var(--chart-3))" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};