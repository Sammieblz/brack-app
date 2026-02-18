import { useState } from "react";
import { Trophy } from "iconoir-react";
import { Button } from "@/components/ui/button";
import {
  DismissableSheet,
  DismissableSheetContent,
  DismissableSheetDescription,
  DismissableSheetHeader,
  DismissableSheetTitle,
  DismissableSheetTrigger,
} from "@/components/ui/dismissable-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GoalManager } from "@/components/GoalManager";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

export const GoalsSheet = () => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();

  if (!user) return null;

  const content = (
    <div className="p-4">
      <GoalManager userId={user.id} />
    </div>
  );

  if (isMobile) {
    return (
      <DismissableSheet open={open} onOpenChange={setOpen}>
        <DismissableSheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Trophy className="h-4 w-4" />
            Goals
          </Button>
        </DismissableSheetTrigger>
        <DismissableSheetContent className="max-h-[85vh]">
          <DismissableSheetHeader>
            <DismissableSheetTitle className="font-display">Reading Goals</DismissableSheetTitle>
            <DismissableSheetDescription className="font-sans">
              Set and track your reading goals
            </DismissableSheetDescription>
          </DismissableSheetHeader>
          <div className="overflow-y-auto">{content}</div>
        </DismissableSheetContent>
      </DismissableSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Trophy className="h-4 w-4" />
          Goals
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Reading Goals</DialogTitle>
          <DialogDescription className="font-sans">
            Set and track your reading goals
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
