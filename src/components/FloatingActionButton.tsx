import { useState } from "react";
import { Plus, BookPlus, Camera, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface FABAction {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

export const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { triggerHaptic } = useHapticFeedback();

  const actions: FABAction[] = [
    {
      icon: BookPlus,
      label: "Add Book",
      onClick: () => {
        triggerHaptic("light");
        navigate("/add-book");
        setIsOpen(false);
      },
    },
    {
      icon: Camera,
      label: "Scan Barcode",
      onClick: () => {
        triggerHaptic("light");
        navigate("/scan-barcode");
        setIsOpen(false);
      },
    },
    {
      icon: Search,
      label: "Search Books",
      onClick: () => {
        triggerHaptic("light");
        navigate("/add-book");
        setIsOpen(false);
      },
    },
  ];

  const handleToggle = () => {
    triggerHaptic(isOpen ? "light" : "medium");
    setIsOpen(!isOpen);
  };

  return (
    <div className="md:hidden fixed bottom-20 right-4 z-40">
      {/* Speed Dial Actions */}
      <div className={cn(
        "flex flex-col-reverse gap-3 mb-3 transition-all duration-200",
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <div
              key={index}
              className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="bg-popover text-popover-foreground px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg border border-border whitespace-nowrap">
                {action.label}
              </span>
              <Button
                size="icon"
                onClick={action.onClick}
                className="h-12 w-12 rounded-full shadow-lg"
              >
                <Icon className="h-5 w-5" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Main FAB */}
      <Button
        size="icon"
        onClick={handleToggle}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-transform",
          isOpen && "rotate-45"
        )}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};
