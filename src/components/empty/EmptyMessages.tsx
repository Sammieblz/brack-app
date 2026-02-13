import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const EmptyMessages = () => {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold mb-2">No messages</h3>
        <p className="font-sans text-sm text-muted-foreground text-center max-w-sm">
          Start a conversation with other readers to discuss books and share recommendations
        </p>
      </CardContent>
    </Card>
  );
};
