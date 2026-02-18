import { Check, Book } from 'iconoir-react';
import { themes } from '@/lib/themes';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export const ThemeSelector = () => {
  const { currentTheme, setTheme } = useTheme();
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {themes.map((theme) => {
        const isHovered = hoveredTheme === theme.id;
        const themeColors = themes.find(t => t.id === theme.id)?.colors.light;
        
        return (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            onMouseEnter={() => setHoveredTheme(theme.id)}
            onMouseLeave={() => setHoveredTheme(null)}
            className={cn(
              "relative p-4 rounded-lg border-2 transition-all hover:scale-105 overflow-hidden group",
              currentTheme === theme.id
                ? "border-primary shadow-lg"
                : "border-border hover:border-primary/50"
            )}
          >
            {currentTheme === theme.id && (
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 z-10">
                <Check className="h-4 w-4" />
              </div>
            )}
            
            <div className="space-y-3 relative z-10">
              <h3 className="font-sans font-semibold text-sm">{theme.name}</h3>
              <div className="flex gap-2">
                {theme.preview.map((color, index) => (
                  <div
                    key={index}
                    className="flex-1 h-12 rounded transition-all duration-300"
                    style={{ 
                      backgroundColor: color,
                      transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                      transitionDelay: `${index * 50}ms`
                    }}
                  />
                ))}
              </div>
              
              {/* Animated Preview Elements */}
              <div 
                className="space-y-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
              >
                <div className="flex gap-2 items-center">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{ 
                      backgroundColor: `hsl(${themeColors?.primary})`,
                      transform: isHovered ? 'scale(1.1) rotate(360deg)' : 'scale(1) rotate(0deg)'
                    }}
                  >
                    <Book className="h-3 w-3" style={{ color: `hsl(${themeColors?.primaryForeground})` }} />
                  </div>
                  <div 
                    className="flex-1 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      backgroundColor: `hsl(${themeColors?.accent})`,
                      width: isHovered ? '100%' : '60%'
                    }}
                  />
                </div>
                
                <div className="flex gap-1 justify-between">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: `hsl(${themeColors?.muted})`,
                      width: isHovered ? '30%' : '25%',
                      transitionDelay: '100ms'
                    }}
                  />
                  <div 
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: `hsl(${themeColors?.secondary})`,
                      width: isHovered ? '45%' : '40%',
                      transitionDelay: '150ms'
                    }}
                  />
                  <div 
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: `hsl(${themeColors?.primary})`,
                      width: isHovered ? '20%' : '25%',
                      transitionDelay: '200ms'
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Animated background gradient on hover */}
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500"
              style={{ 
                background: `linear-gradient(135deg, hsl(${themeColors?.primary}), hsl(${themeColors?.secondary}))`
              }}
            />
          </button>
        );
      })}
    </div>
  );
};
