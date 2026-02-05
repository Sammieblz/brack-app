import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const EmptyActivity = () => {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Activity className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Start reading and sharing to see activity from you and your friends
        </p>
      </CardContent>
    </Card>
  );
};
