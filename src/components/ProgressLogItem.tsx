import { formatDate, formatDuration } from "@/utils";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { BookOpen, Clock, FileText } from "lucide-react";

interface ProgressLog {
  id: string;
  page_number: number;
  paragraph_number?: number;
  notes?: string;
  logged_at: string;
  log_type: 'manual' | 'timer_based' | 'automatic';
  time_spent_minutes?: number;
}

interface ProgressLogItemProps {
  log: ProgressLog;
}

export const ProgressLogItem = ({ log }: ProgressLogItemProps) => {
  const logTypeColors = {
    manual: 'bg-primary/10 text-primary border-primary/20',
    timer_based: 'bg-accent/10 text-accent border-accent/20',
    automatic: 'bg-secondary/10 text-secondary-foreground border-secondary/20',
  };

  const logTypeLabels = {
    manual: 'Manual',
    timer_based: 'Timer',
    automatic: 'Auto',
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={logTypeColors[log.log_type]}>
              {logTypeLabels[log.log_type]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatDate(log.logged_at)}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Page {log.page_number}</span>
              {log.paragraph_number && (
                <span className="text-muted-foreground">
                  , ¶{log.paragraph_number}
                </span>
              )}
            </div>

            {log.time_spent_minutes && log.time_spent_minutes > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(log.time_spent_minutes)}</span>
              </div>
            )}
          </div>

          {log.notes && (
            <div className="mt-2 p-2 bg-muted/50 rounded-md">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm text-foreground/90">{log.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
