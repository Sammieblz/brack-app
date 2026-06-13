import { ThemePaletteCarousel } from "@/components/ThemePaletteCarousel";
import { useTheme } from "@/contexts/ThemeContext";

export const ThemeSelector = () => {
  const { currentTheme, resolvedTheme, setTheme } = useTheme();

  return (
    <ThemePaletteCarousel
      selectedTheme={currentTheme}
      previewMode={resolvedTheme === "dark" ? "dark" : "light"}
      onSelectTheme={setTheme}
    />
  );
};
