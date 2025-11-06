import { Check } from 'lucide-react';
import { themes } from '@/lib/themes';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export const ThemeSelector = () => {
  const { currentTheme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => setTheme(theme.id)}
          className={cn(
            "relative p-4 rounded-lg border-2 transition-all hover:scale-105",
            currentTheme === theme.id
              ? "border-primary shadow-lg"
              : "border-border hover:border-primary/50"
          )}
        >
          {currentTheme === theme.id && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
              <Check className="h-4 w-4" />
            </div>
          )}
          
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">{theme.name}</h3>
            <div className="flex gap-2">
              {theme.preview.map((color, index) => (
                <div
                  key={index}
                  className="flex-1 h-12 rounded"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
