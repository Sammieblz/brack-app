import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "lucide-react";

interface HeatmapData {
  date: string;
  value: number;
}

interface ReadingHeatmapProps {
  data: HeatmapData[];
}

export const ReadingHeatmap = ({ data }: ReadingHeatmapProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  // Generate calendar grid (last 12 months)
  const months: { [key: string]: HeatmapData[] } = {};
  const today = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - i);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    months[monthKey] = [];
  }

  // Group data by month
  data.forEach(item => {
    const date = new Date(item.date);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (months[monthKey]) {
      months[monthKey].push(item);
    }
  });

  // Calculate intensity levels
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const getIntensity = (value: number) => {
    if (value === 0) return 0;
    const ratio = value / maxValue;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base md:text-lg">
          <Calendar className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          Reading Activity Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="space-y-4">
          {Object.entries(months).map(([month, monthData]) => {
            const daysInMonth = new Date(month.split(' ')[1], new Date(`${month} 1`).getMonth() + 1, 0).getDate();
            const firstDay = new Date(`${month} 1`).getDay();
            
            return (
              <div key={month} className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">{month}</div>
                <div className="grid grid-cols-7 gap-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <div key={day} className="text-xs text-center text-muted-foreground p-1">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${month} ${day}`;
                    const dayData = monthData.find(d => {
                      const dDate = new Date(d.date);
                      return dDate.getDate() === day;
                    });
                    const intensity = dayData ? getIntensity(dayData.value) : 0;
                    const bgColors = [
                      'bg-muted/20',
                      'bg-primary/30',
                      'bg-primary/50',
                      'bg-primary/70',
                      'bg-primary',
                    ];

                    return (
                      <TooltipProvider key={day}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`aspect-square rounded-sm ${bgColors[intensity]} transition-colors hover:ring-2 hover:ring-primary cursor-pointer`}
                            />
                          </TooltipTrigger>
                          {dayData && (
                            <TooltipContent>
                              <div className="space-y-1">
                                <div className="text-xs font-semibold">{dateStr}</div>
                                <div className="text-sm font-bold">{dayData.value} min</div>
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-muted/20" />
              <div className="w-3 h-3 rounded-sm bg-primary/30" />
              <div className="w-3 h-3 rounded-sm bg-primary/50" />
              <div className="w-3 h-3 rounded-sm bg-primary/70" />
              <div className="w-3 h-3 rounded-sm bg-primary" />
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
