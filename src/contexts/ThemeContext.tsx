import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getTheme, type ThemeColors } from '@/lib/themes';

interface ThemeContextType {
  currentTheme: string;
  setTheme: (themeId: string) => Promise<void>;
  themeMode: string | undefined;
  setThemeMode: (mode: 'light' | 'dark' | 'system') => Promise<void>;
  resolvedTheme: string | undefined;
  isLoading: boolean;
  /** Resets color theme to 'default'. Called on sign-out and on unauthenticated pages. */
  resetToDefaultTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const applyThemeColors = (colors: ThemeColors) => {
  const root = document.documentElement;
  
  Object.entries(colors).forEach(([key, value]) => {
    // Convert camelCase to kebab-case, handling special cases like chart1 -> chart-1
    let cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    // Handle chartN pattern (chart1 -> chart-1, chart2 -> chart-2, etc.)
    cssVar = cssVar.replace(/chart(\d+)/g, 'chart-$1');
    root.style.setProperty(`--${cssVar}`, value);
  });
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { theme: themeMode, setTheme: setNextTheme, resolvedTheme } = useNextTheme();
  const [currentTheme, setCurrentTheme] = useState('default');
  const [isLoading, setIsLoading] = useState(true);

  // ── Reset to default theme (synchronous, no DB call) ────────────────
  const resetToDefaultTheme = useCallback(() => {
    localStorage.removeItem('color_theme');
    const theme = getTheme('default');
    const isDark = document.documentElement.classList.contains('dark');
    const colors = isDark ? theme.colors.dark : theme.colors.light;
    applyThemeColors(colors);
    setCurrentTheme('default');
  }, []);

  // ── Auto-reset when user signs out (user becomes null) ──────────────
  useEffect(() => {
    if (!user) {
      resetToDefaultTheme();
      setIsLoading(false);
    }
  }, [user, resetToDefaultTheme]);

  // Load user's saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      if (!user) {
        // No user → ensure defaults are applied (handled by the auto-reset above)
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('color_theme, theme_mode')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        // Determine theme to use: DB value, or 'default' for new users
        const themeId = data?.color_theme || 'default';
        const themeModeToUse = data?.theme_mode || 'system';
        
        // If new user (no color_theme or theme_mode in DB), save defaults to DB
        if (!data?.color_theme || !data?.theme_mode) {
          await supabase
            .from('profiles')
            .upsert({ 
              id: user.id,
              color_theme: themeId,
              theme_mode: themeModeToUse,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });
        }

        // Apply theme mode first (so dark class is set correctly)
        setNextTheme(themeModeToUse);

        // Set currentTheme state immediately - the effect below will apply colors when resolvedTheme is ready
        setCurrentTheme(themeId);
        localStorage.setItem('color_theme', themeId);
        
        // If resolvedTheme is already available, apply colors immediately
        // Otherwise, the effect below will apply when resolvedTheme becomes available
        if (resolvedTheme) {
          const theme = getTheme(themeId);
          const isDark = resolvedTheme === 'dark';
          const colors = isDark ? theme.colors.dark : theme.colors.light;
          applyThemeColors(colors);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        // Fallback to default theme on error
        const theme = getTheme('default');
        const isDark = resolvedTheme === 'dark' || document.documentElement.classList.contains('dark');
        const colors = isDark ? theme.colors.dark : theme.colors.light;
        applyThemeColors(colors);
        setCurrentTheme('default');
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, [user, setNextTheme, resolvedTheme]);

  useEffect(() => {
    if (!user) return;
    
    // Wait for resolvedTheme to be available before applying colors
    if (!resolvedTheme) return;

    const theme = getTheme(currentTheme);
    const isDark = resolvedTheme === 'dark';
    const colors = isDark ? theme.colors.dark : theme.colors.light;
    applyThemeColors(colors);
  }, [currentTheme, user, resolvedTheme]);

  const setTheme = async (themeId: string) => {
    if (!user) return;

    try {
      // Apply theme immediately, respecting current theme mode (light/dark)
      const theme = getTheme(themeId);
      const isDark = document.documentElement.classList.contains('dark');
      const colors = isDark ? theme.colors.dark : theme.colors.light;
      applyThemeColors(colors);
      setCurrentTheme(themeId);
      
      // Cache in localStorage for instant load on next visit
      localStorage.setItem('color_theme', themeId);

      // Save to database (use upsert to ensure it's set even for new users)
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          color_theme: themeId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving theme:', error);
      // Revert to previous theme on error
      const previousTheme = localStorage.getItem('color_theme') || 'default';
      const theme = getTheme(previousTheme);
      const isDark = document.documentElement.classList.contains('dark');
      const colors = isDark ? theme.colors.dark : theme.colors.light;
      applyThemeColors(colors);
      setCurrentTheme(previousTheme);
    }
  };

  const setThemeMode = async (mode: 'light' | 'dark' | 'system') => {
    setNextTheme(mode);
    
    // Wait for theme mode to apply, then re-apply color theme with correct variant
    setTimeout(() => {
      const theme = getTheme(currentTheme);
      const isDark = document.documentElement.classList.contains('dark');
      const colors = isDark ? theme.colors.dark : theme.colors.light;
      applyThemeColors(colors);
    }, 0);
    
    if (user) {
      try {
        // Save to database (use upsert to ensure it's set even for new users)
        const { error } = await supabase
          .from('profiles')
          .upsert({ 
            id: user.id,
            theme_mode: mode,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error saving theme mode:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      currentTheme, setTheme, themeMode, setThemeMode, 
      resolvedTheme, isLoading, resetToDefaultTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
