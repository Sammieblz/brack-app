import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Scatter, ScatterChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import { BookOpen } from "lucide-react";

interface ScatterData {
  pages: number;
  completionDays: number;
  title: string;
}

interface BookLengthScatterProps {
  data: ScatterData[];
}

const chartConfig = {
  completionDays: {
    label: "Days to Complete",
    color: "hsl(var(--chart-3))",
  },
};

export const BookLengthScatter = ({ data }: BookLengthScatterProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <BookOpen className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Book Length vs Completion Time
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <ScatterChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
            <XAxis 
              type="number"
              dataKey="pages" 
              name="Pages"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              label={{ value: 'Pages', position: 'insideBottom', offset: -5, style: { fontFamily: 'Inter, system-ui, sans-serif' } }}
            />
            <YAxis 
              type="number"
              dataKey="completionDays" 
              name="Days"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tick={{ fontSize: 11 }}
              width={40}
              label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fontFamily: 'Inter, system-ui, sans-serif' } }}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as ScatterData;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <div className="space-y-1">
                        <div className="font-serif font-semibold text-sm">{data.title}</div>
                        <div className="font-sans text-xs text-muted-foreground">
                          {data.pages} pages
                        </div>
                        <div className="font-sans text-xs text-muted-foreground">
                          {data.completionDays} days to complete
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
            />
            <Scatter
              dataKey="completionDays"
              fill="hsl(var(--chart-3))"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="hsl(var(--chart-3))" />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
