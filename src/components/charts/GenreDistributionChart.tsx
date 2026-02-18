import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { BookOpen } from "lucide-react";
import type { GenreData } from "@/hooks/useChartData";

interface GenreDistributionChartProps {
  data: GenreData[];
}

const chartConfig = {
  count: {
    label: "Books",
  },
};

export const GenreDistributionChart = ({ data }: GenreDistributionChartProps) => {
  const totalBooks = data.reduce((sum, item) => sum + item.count, 0);
  const topGenres = data.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <BookOpen className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Books by Genre
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="count"
                animationDuration={750}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              {/* Center stats */}
              <text
                x="50%"
                y="45%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-sans text-2xl md:text-3xl font-bold fill-foreground"
              >
                {totalBooks}
              </text>
              <text
                x="50%"
                y="55%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-sans text-xs md:text-sm fill-muted-foreground"
              >
                Total Books
              </text>
              <text
                x="50%"
                y="65%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-sans text-xs fill-muted-foreground"
              >
                {topGenres} Genres
              </text>
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const percentage = ((data.count / totalBooks) * 100).toFixed(1);
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: data.color }}
                            />
                            <span className="font-sans font-semibold text-sm">
                              {data.genre}
                            </span>
                          </div>
                          <div className="font-sans flex justify-between gap-4 text-xs">
                            <span className="text-muted-foreground">Books:</span>
                            <span className="font-bold">{data.count}</span>
                          </div>
                          <div className="font-sans flex justify-between gap-4 text-xs">
                            <span className="text-muted-foreground">Share:</span>
                            <span className="font-bold">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};