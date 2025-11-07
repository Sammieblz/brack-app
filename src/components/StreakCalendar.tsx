import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";
import type { DayActivity } from "@/utils/streakCalculation";

interface StreakCalendarProps {
  activityCalendar: DayActivity[];
}

export const StreakCalendar = ({ activityCalendar }: StreakCalendarProps) => {
  const getActivityColor = (activity: DayActivity) => {
    if (!activity.hasActivity) return "bg-muted";
    
    const minutes = activity.totalMinutes;
    if (minutes >= 60) return "bg-primary";
    if (minutes >= 30) return "bg-primary/70";
    if (minutes >= 15) return "bg-primary/50";
    return "bg-primary/30";
  };

  const getActivityLabel = (activity: DayActivity) => {
    if (!activity.hasActivity) return "No activity";
    
    const hours = Math.floor(activity.totalMinutes / 60);
    const mins = activity.totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    return `${activity.sessionCount} session${activity.sessionCount > 1 ? 's' : ''} • ${timeStr}`;
  };

  // Group by weeks for display
  const weeks: DayActivity[][] = [];
  for (let i = 0; i < activityCalendar.length; i += 7) {
    weeks.push(activityCalendar.slice(i, i + 7));
  }

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date().toISOString().split("T")[0];

  return (
    <Card className="bg-gradient-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          Reading Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayLabels.map((day, i) => (
              <div key={i} className="text-xs text-muted-foreground text-center font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-1">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 gap-1">
                {week.map((day, dayIdx) => {
                  const isToday = day.date === today;
                  const date = new Date(day.date);
                  
                  return (
                    <div
                      key={dayIdx}
                      className="relative group"
                      title={getActivityLabel(day)}
                    >
                      <div
                        className={`
                          aspect-square rounded 
                          ${getActivityColor(day)}
                          ${isToday ? 'ring-2 ring-primary ring-offset-2' : ''}
                          transition-all hover:scale-110 cursor-pointer
                        `}
                      />
                      
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        <div className="font-medium">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        <div className="text-muted-foreground">{getActivityLabel(day)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded bg-muted" />
              <div className="w-3 h-3 rounded bg-primary/30" />
              <div className="w-3 h-3 rounded bg-primary/50" />
              <div className="w-3 h-3 rounded bg-primary/70" />
              <div className="w-3 h-3 rounded bg-primary" />
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
