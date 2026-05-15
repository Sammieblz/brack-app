import { Check, Book } from 'iconoir-react';
import { themes, type Theme, type ThemeColors } from '@/lib/themes';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useState, type CSSProperties } from 'react';

const surfaceStyleLabels: Record<NonNullable<Theme['surfaceStyle']>, string> = {
  standard: 'Classic color',
  paper: 'Paper texture',
  glass: 'Glass surfaces',
  comic: 'Panel outlines',
  'coloring-book': 'Outlined pages',
};

const hsl = (value: string, alpha?: number) =>
  alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;

const getPreviewFrameStyle = (
  theme: Theme,
  colors: ThemeColors,
  isHovered: boolean
): CSSProperties => {
  const surfaceStyle = theme.surfaceStyle ?? 'standard';
  const base: CSSProperties = {
    backgroundColor: hsl(colors.background),
    borderColor: hsl(colors.border),
    color: hsl(colors.foreground),
  };

  if (surfaceStyle === 'paper') {
    return {
      ...base,
      backgroundImage: `linear-gradient(90deg, transparent 0, transparent 26%, ${hsl(colors.destructive, 0.08)} 27%, transparent 28%), repeating-linear-gradient(0deg, transparent 0 17px, ${hsl(colors.primary, 0.08)} 18px, transparent 19px), radial-gradient(circle at 1px 1px, ${hsl(colors.foreground, 0.05)} 1px, transparent 0), ${colors.gradientCard}`,
      backgroundSize: '100% 100%, 100% 19px, 12px 12px, 100% 100%',
      boxShadow: isHovered ? colors.shadowMedium : colors.shadowSoft,
    };
  }

  if (surfaceStyle === 'glass') {
    return {
      ...base,
      backgroundColor: hsl(colors.card, 0.62),
      backgroundImage: `linear-gradient(145deg, hsl(0 0% 100% / 0.2), transparent 44%), ${colors.gradientCard}`,
      backdropFilter: 'blur(10px) saturate(1.2)',
      boxShadow: isHovered ? colors.shadowGlow : colors.shadowSoft,
    };
  }

  if (surfaceStyle === 'comic') {
    return {
      ...base,
      borderColor: hsl(colors.border),
      borderWidth: 2,
      boxShadow: isHovered ? colors.shadowMedium : colors.shadowSoft,
    };
  }

  if (surfaceStyle === 'coloring-book') {
    return {
      ...base,
      backgroundImage: `linear-gradient(0deg, ${hsl(colors.border, 0.04)} 1px, transparent 1px), linear-gradient(90deg, ${hsl(colors.border, 0.04)} 1px, transparent 1px), ${colors.gradientCard}`,
      backgroundSize: '14px 14px, 14px 14px, 100% 100%',
      borderColor: hsl(colors.border, 0.82),
      borderWidth: 2,
      boxShadow: 'none',
    };
  }

  return {
    ...base,
    backgroundImage: colors.gradientCard,
    boxShadow: isHovered ? colors.shadowMedium : colors.shadowSoft,
  };
};

export const ThemeSelector = () => {
  const { currentTheme, setTheme } = useTheme();
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {themes.map((theme) => {
        const isHovered = hoveredTheme === theme.id;
        const themeColors = theme.colors.light;
        const surfaceStyle = theme.surfaceStyle ?? 'standard';
        
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
              <div>
                <h3 className="font-sans font-semibold text-sm">{theme.name}</h3>
                <p className="font-sans text-xs text-muted-foreground">
                  {surfaceStyleLabels[surfaceStyle]}
                </p>
              </div>
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
                className="overflow-hidden rounded-md border transition-all duration-300"
                style={getPreviewFrameStyle(theme, themeColors, isHovered)}
              >
                <div
                  className="flex h-7 items-center gap-1.5 border-b px-2"
                  style={{
                    backgroundColor: hsl(themeColors.card, surfaceStyle === 'glass' ? 0.62 : 1),
                    borderColor: hsl(themeColors.border),
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.preview[0] }} />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.preview[1] }} />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.preview[2] }} />
                  <span
                    className="ml-auto h-2 w-10 rounded-full"
                    style={{ backgroundColor: hsl(themeColors.muted) }}
                  />
                </div>
                <div className="grid grid-cols-[2.25rem_minmax(0,1fr)]">
                  <div
                    className="space-y-1.5 border-r p-1.5"
                    style={{
                      backgroundColor: hsl(themeColors.muted, surfaceStyle === 'glass' ? 0.58 : 1),
                      borderColor: hsl(themeColors.border),
                    }}
                  >
                    <span className="block h-4 rounded-sm" style={{ backgroundColor: hsl(themeColors.primary) }} />
                    <span className="block h-4 rounded-sm opacity-70" style={{ backgroundColor: hsl(themeColors.card) }} />
                    <span className="block h-4 rounded-sm opacity-70" style={{ backgroundColor: hsl(themeColors.card) }} />
                  </div>
                  <div className="space-y-2 p-2">
                    <span className="block h-2 w-3/5 rounded-full" style={{ backgroundColor: hsl(themeColors.primary) }} />
                    <span className="block h-2 w-full rounded-full" style={{ backgroundColor: hsl(themeColors.muted) }} />
                    <span className="block h-2 w-4/5 rounded-full" style={{ backgroundColor: hsl(themeColors.secondary) }} />
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <span className="h-6 rounded-sm" style={{ backgroundColor: theme.preview[0] }} />
                      <span className="h-6 rounded-sm" style={{ backgroundColor: theme.preview[1] }} />
                      <span className="h-6 rounded-sm" style={{ backgroundColor: theme.preview[2] }} />
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className="space-y-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
              >
                <div className="flex gap-2 items-center">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{ 
                      backgroundColor: hsl(themeColors.primary),
                      transform: isHovered ? 'scale(1.1) rotate(360deg)' : 'scale(1) rotate(0deg)'
                    }}
                  >
                    <Book className="h-3 w-3" style={{ color: hsl(themeColors.primaryForeground) }} />
                  </div>
                  <div 
                    className="flex-1 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      backgroundColor: hsl(themeColors.accent),
                      width: isHovered ? '100%' : '60%'
                    }}
                  />
                </div>
                
                <div className="flex gap-1 justify-between">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: hsl(themeColors.muted),
                      width: isHovered ? '30%' : '25%',
                      transitionDelay: '100ms'
                    }}
                  />
                  <div 
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: hsl(themeColors.secondary),
                      width: isHovered ? '45%' : '40%',
                      transitionDelay: '150ms'
                    }}
                  />
                  <div 
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: hsl(themeColors.primary),
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
                background: `linear-gradient(135deg, ${hsl(themeColors.primary)}, ${hsl(themeColors.secondary)})`
              }}
            />
          </button>
        );
      })}
    </div>
  );
};
