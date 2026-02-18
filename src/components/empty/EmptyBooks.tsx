import { Book, Plus } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export const EmptyBooks = () => {
  const navigate = useNavigate();

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Book className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold mb-2">No books yet</h3>
        <p className="font-sans text-sm text-muted-foreground text-center mb-6 max-w-sm">
          Start building your reading library by adding your first book
        </p>
        <Button onClick={() => navigate("/add-book")} className="min-h-[44px]">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Book
        </Button>
      </CardContent>
    </Card>
  );
};
