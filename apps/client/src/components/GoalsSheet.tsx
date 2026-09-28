import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { APP_ICONS } from "@/config/iconography";

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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <APP_ICONS.dashboard.goal className="h-4 w-4" />
            Goals
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 rounded-t-[20px] p-0 [&>button]:size-11 [&>button]:right-2 [&>button]:top-2">
          <SheetHeader className="px-6 pr-14 pt-4">
            <SheetTitle className="font-display">Reading Goals</SheetTitle>
            <SheetDescription className="font-sans">
              Set and track your reading goals
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <APP_ICONS.dashboard.goal className="h-4 w-4" />
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
