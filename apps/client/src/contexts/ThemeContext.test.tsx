import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchThemePreferencesMock,
  setNextThemeMock,
  upsertThemePreferencesMock,
} = vi.hoisted(() => ({
  fetchThemePreferencesMock: vi.fn(),
  setNextThemeMock: vi.fn(),
  upsertThemePreferencesMock: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: setNextThemeMock,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "reader-1" },
    loading: false,
  }),
}));

vi.mock("@/services/api", () => ({
  fetchThemePreferences: fetchThemePreferencesMock,
  THEME_PREFERENCES_CHANGED_EVENT: "brack:theme-preferences-changed",
  upsertThemePreferences: upsertThemePreferencesMock,
}));

import { ThemeProvider, useTheme } from "./ThemeContext";

const ThemeProbe = () => {
  const { currentTheme, isLoading } = useTheme();
  return <output>{isLoading ? "loading" : currentTheme}</output>;
};

describe("ThemeProvider preference handoff", () => {
  beforeEach(() => {
    fetchThemePreferencesMock.mockReset();
    fetchThemePreferencesMock.mockResolvedValue({
      color_theme: "default",
      theme_mode: "light",
      library_view_mode: "flat",
    });
    setNextThemeMock.mockReset();
    upsertThemePreferencesMock.mockReset();
    localStorage.clear();
  });

  it("adopts the authenticated onboarding palette as soon as the local profile write completes", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await screen.findByText("default");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("brack:theme-preferences-changed", {
          detail: {
            userId: "reader-1",
            preferences: {
              color_theme: "midnight",
              theme_mode: "dark",
              library_view_mode: "flat",
            },
          },
        }),
      );
    });

    expect(screen.getByText("midnight")).toBeInTheDocument();
    expect(localStorage.getItem("color_theme")).toBe("midnight");
    expect(setNextThemeMock).toHaveBeenCalledWith("dark");
  });

  it("ignores preference events owned by another reader", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await screen.findByText("default");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("brack:theme-preferences-changed", {
          detail: {
            userId: "reader-2",
            preferences: {
              color_theme: "midnight",
              theme_mode: "dark",
              library_view_mode: "flat",
            },
          },
        }),
      );
    });

    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());
    expect(localStorage.getItem("color_theme")).toBe("default");
  });

  it("does not let an older server read overwrite a newer onboarding palette", async () => {
    let resolvePreferences: ((value: {
      color_theme: string;
      theme_mode: string;
      library_view_mode: string;
    }) => void) | undefined;
    fetchThemePreferencesMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePreferences = resolve;
      }),
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("brack:theme-preferences-changed", {
          detail: {
            userId: "reader-1",
            preferences: {
              color_theme: "midnight",
              theme_mode: "dark",
              library_view_mode: "flat",
            },
          },
        }),
      );
    });

    await act(async () => {
      resolvePreferences?.({
        color_theme: "default",
        theme_mode: "light",
        library_view_mode: "flat",
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("midnight")).toBeInTheDocument();
    expect(localStorage.getItem("color_theme")).toBe("midnight");
  });
});
