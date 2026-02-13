import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const Header = ({ title, subtitle, onBack, rightAction }: HeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        {onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="border-border/50 hover:shadow-soft transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="font-sans text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {rightAction}
    </div>
  );
};