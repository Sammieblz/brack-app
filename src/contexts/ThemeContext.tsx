import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getTheme, type ThemeColors } from '@/lib/themes';

interface ThemeContextType {
  currentTheme: string;
  setTheme: (themeId: string) => Promise<void>;
  isLoading: boolean;
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
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState('default');
  const [isLoading, setIsLoading] = useState(true);

  // Load user's saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      // First, try to load from localStorage for instant application
      const cachedTheme = localStorage.getItem('color_theme');
      if (cachedTheme) {
        const theme = getTheme(cachedTheme);
        const isDark = document.documentElement.classList.contains('dark');
        const colors = isDark ? theme.colors.dark : theme.colors.light;
        applyThemeColors(colors);
        setCurrentTheme(cachedTheme);
      }

      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('color_theme')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.color_theme) {
          const theme = getTheme(data.color_theme);
          const isDark = document.documentElement.classList.contains('dark');
          const colors = isDark ? theme.colors.dark : theme.colors.light;
          applyThemeColors(colors);
          setCurrentTheme(data.color_theme);
          localStorage.setItem('color_theme', data.color_theme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, [user]);

  // Apply theme when system theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = getTheme(currentTheme);
      const isDark = document.documentElement.classList.contains('dark');
      const colors = isDark ? theme.colors.dark : theme.colors.light;
      applyThemeColors(colors);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [currentTheme]);

  const setTheme = async (themeId: string) => {
    if (!user) return;

    try {
      // Apply theme immediately
      const theme = getTheme(themeId);
      const isDark = document.documentElement.classList.contains('dark');
      const colors = isDark ? theme.colors.dark : theme.colors.light;
      applyThemeColors(colors);
      setCurrentTheme(themeId);
      
      // Cache in localStorage for instant load on next visit
      localStorage.setItem('color_theme', themeId);

      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update({ color_theme: themeId })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};
