import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const DarkModeToggle = () => {
  const { themeMode, setThemeMode } = useTheme();

  const modes = [
    { 
      value: 'light' as const, 
      icon: Sun, 
      label: 'Light Mode',
      description: 'Always use light theme'
    },
    { 
      value: 'dark' as const, 
      icon: Moon, 
      label: 'Dark Mode',
      description: 'Always use dark theme'
    },
    { 
      value: 'system' as const, 
      icon: Monitor, 
      label: 'System',
      description: 'Follow system preference'
    },
  ];

  return (
    <TooltipProvider>
      <div className="flex gap-2">
        {modes.map(({ value, icon: Icon, label, description }) => {
          const isActive = themeMode === value;
          
          return (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? "default" : "outline"}
                  size="icon"
                  onClick={() => setThemeMode(value)}
                  className="transition-all duration-200"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
