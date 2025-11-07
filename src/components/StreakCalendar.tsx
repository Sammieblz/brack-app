import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, ChevronLeft, ChevronRight } from "lucide-react";
import type { DayActivity } from "@/utils/streakCalculation";

interface StreakCalendarProps {
  activityCalendar: DayActivity[];
}

export const StreakCalendar = ({ activityCalendar }: StreakCalendarProps) => {
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);

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

  // Get current month data
  const today = new Date();
  const displayMonth = new Date(today.getFullYear(), today.getMonth() - currentMonthOffset, 1);
  const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const monthEnd = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
  
  // Filter activities for current displayed month
  const monthActivities = activityCalendar.filter(activity => {
    const activityDate = new Date(activity.date);
    return activityDate >= monthStart && activityDate <= monthEnd;
  });

  // Pad the beginning to align with correct day of week
  const firstDayOfWeek = monthStart.getDay();
  const paddedActivities: (DayActivity | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...monthActivities
  ];

  // Group by weeks for display
  const weeks: (DayActivity | null)[][] = [];
  for (let i = 0; i < paddedActivities.length; i += 7) {
    weeks.push(paddedActivities.slice(i, i + 7));
  }

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const todayStr = today.toISOString().split("T")[0];
  
  const canGoBack = currentMonthOffset < 2; // Allow going back 3 months (0, 1, 2)
  const canGoForward = currentMonthOffset > 0;

  const monthName = displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Card className="bg-gradient-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentMonthOffset(currentMonthOffset + 1)}
              disabled={!canGoBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {monthName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentMonthOffset(currentMonthOffset - 1)}
              disabled={!canGoForward}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-2">
          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1">
            {dayLabels.map((day, i) => (
              <div key={i} className="text-[10px] text-muted-foreground text-center font-medium h-5 flex items-center justify-center">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-1">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 gap-1">
                {week.map((day, dayIdx) => {
                  if (!day) {
                    return <div key={dayIdx} className="aspect-square" />;
                  }
                  
                  const isToday = day.date === todayStr;
                  const date = new Date(day.date);
                  
                  return (
                    <div
                      key={dayIdx}
                      className="relative group"
                      title={getActivityLabel(day)}
                    >
                      <div
                        className={`
                          aspect-square rounded-sm
                          ${getActivityColor(day)}
                          ${isToday ? 'ring-1 ring-primary ring-offset-1' : ''}
                          transition-all hover:scale-110 cursor-pointer
                        `}
                      />
                      
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
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
          <div className="flex items-center justify-between pt-3 border-t text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-muted" />
              <div className="w-2.5 h-2.5 rounded-sm bg-primary/30" />
              <div className="w-2.5 h-2.5 rounded-sm bg-primary/50" />
              <div className="w-2.5 h-2.5 rounded-sm bg-primary/70" />
              <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
