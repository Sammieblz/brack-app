import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider as ModeProvider } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme } from "@/lib/themes";

const savePreferences = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock("@/services/api", () => ({
  fetchThemePreferences: vi.fn(),
  upsertThemePreferences: savePreferences,
  THEME_PREFERENCES_CHANGED_EVENT: "brack:theme-preferences-changed",
}));

import { ThemeProvider, useTheme } from "./ThemeContext";

const GuestPaletteControls = () => {
  const { previewTheme, setThemeMode, resetToDefaultTheme, currentTheme, resolvedTheme } = useTheme();
  return (
    <>
      <output>{currentTheme}:{resolvedTheme}</output>
      <button onClick={() => previewTheme("purple-sage")}>Preview purple</button>
      <button onClick={() => void setThemeMode("dark")}>Dark</button>
      <button onClick={() => void setThemeMode("light")}>Light</button>
      <button onClick={resetToDefaultTheme}>Leave onboarding</button>
    </>
  );
};

describe("guest palette and light/dark mode", () => {
  beforeEach(() => {
    localStorage.clear();
    savePreferences.mockClear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
  });

  afterEach(cleanup);

  it("keeps the preview palette through mode switches without persisting it", async () => {
    render(
      <ModeProvider attribute="class" defaultTheme="light" storageKey="theme-mode" enableSystem={false}>
        <ThemeProvider><GuestPaletteControls /></ThemeProvider>
      </ModeProvider>,
    );
    await screen.findByText("default:light");
    fireEvent.click(screen.getByRole("button", { name: "Preview purple" }));
    await screen.findByText("purple-sage:light");

    for (const mode of ["dark", "light"] as const) {
      fireEvent.click(screen.getByRole("button", { name: mode === "dark" ? "Dark" : "Light" }));
      await screen.findByText(`purple-sage:${mode}`);
      // Let pending callbacks settle too: the old deferred reapply reset guests.
      await new Promise((resolve) => setTimeout(resolve, 20));
      await waitFor(() => expect(document.documentElement.style.getPropertyValue("--primary"))
        .toBe(getTheme("purple-sage").colors[mode].primary));
      expect(localStorage.getItem("color_theme")).toBeNull();
      expect(savePreferences).not.toHaveBeenCalled();
    }

    fireEvent.click(screen.getByRole("button", { name: "Leave onboarding" }));
    await screen.findByText("default:light");
    expect(document.documentElement.style.getPropertyValue("--primary"))
      .toBe(getTheme("default").colors.light.primary);
  });
});
