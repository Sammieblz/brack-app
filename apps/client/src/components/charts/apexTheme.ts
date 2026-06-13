import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { useTheme } from "@/contexts/ThemeContext";

const FONT_FAMILY = "Inter, system-ui, sans-serif";

const FALLBACK_COLORS = {
  primary: "hsl(20 90% 58%)",
  background: "hsl(45 100% 98%)",
  foreground: "hsl(25 5% 15%)",
  mutedForeground: "hsl(25 8% 45%)",
  border: "hsl(45 20% 90%)",
  card: "hsl(0 0% 100%)",
  popover: "hsl(0 0% 100%)",
  popoverForeground: "hsl(25 5% 15%)",
  muted: "hsl(45 20% 96%)",
  destructive: "hsl(0 84.2% 60.2%)",
  chart: [
    "hsl(200 70% 50%)",
    "hsl(160 60% 45%)",
    "hsl(30 80% 55%)",
    "hsl(280 65% 55%)",
    "hsl(340 75% 55%)",
  ],
};

const readCssVar = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value ? `hsl(${value})` : fallback;
};

const readCssVarAlpha = (name: string, alpha: number, fallback: string) => {
  if (typeof window === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value ? `hsl(${value} / ${alpha})` : fallback;
};

const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
};

export const useApexTheme = () => {
  const { currentTheme, resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [themeRevision, setThemeRevision] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frame = window.requestAnimationFrame(() => {
      setThemeRevision((value) => value + 1);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentTheme, resolvedTheme]);

  return useMemo(() => {
    const colors = {
      primary: readCssVar("--primary", FALLBACK_COLORS.primary),
      primarySoft: readCssVarAlpha("--primary", 0.16, "hsl(20 90% 58% / 0.16)"),
      background: readCssVar("--background", FALLBACK_COLORS.background),
      backgroundSoft: readCssVarAlpha("--background", 0.72, "hsl(45 100% 98% / 0.72)"),
      foreground: readCssVar("--foreground", FALLBACK_COLORS.foreground),
      mutedForeground: readCssVar("--muted-foreground", FALLBACK_COLORS.mutedForeground),
      border: readCssVar("--border", FALLBACK_COLORS.border),
      borderFaint: readCssVarAlpha("--border", 0.32, "hsl(45 20% 90% / 0.32)"),
      borderSubtle: readCssVarAlpha("--border", 0.65, "hsl(45 20% 90% / 0.65)"),
      card: readCssVar("--card", FALLBACK_COLORS.card),
      cardSoft: readCssVarAlpha("--card", 0.68, "hsl(0 0% 100% / 0.68)"),
      popover: readCssVar("--popover", FALLBACK_COLORS.popover),
      popoverForeground: readCssVar("--popover-foreground", FALLBACK_COLORS.popoverForeground),
      muted: readCssVar("--muted", FALLBACK_COLORS.muted),
      mutedFaint: readCssVarAlpha("--muted", 0.28, "hsl(45 20% 96% / 0.28)"),
      mutedSoft: readCssVarAlpha("--muted", 0.55, "hsl(45 20% 96% / 0.55)"),
      destructive: readCssVar("--destructive", FALLBACK_COLORS.destructive),
      chart: FALLBACK_COLORS.chart.map((fallback, index) =>
        readCssVar(`--chart-${index + 1}`, fallback)
      ),
    };

    const mode = resolvedTheme === "dark" ? "dark" : "light";

    const baseOptions: ApexOptions = {
      chart: {
        background: "transparent",
        fontFamily: FONT_FAMILY,
        foreColor: colors.mutedForeground,
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: {
          enabled: !reducedMotion,
          speed: reducedMotion ? 0 : 420,
          animateGradually: {
            enabled: !reducedMotion,
            delay: 55,
          },
          dynamicAnimation: {
            enabled: !reducedMotion,
            speed: reducedMotion ? 0 : 280,
          },
        },
      },
      theme: { mode },
      colors: colors.chart,
      dataLabels: { enabled: false },
      grid: {
        borderColor: colors.borderSubtle,
        strokeDashArray: 4,
        padding: {
          top: 4,
          right: 8,
          bottom: 0,
          left: 4,
        },
      },
      legend: {
        fontFamily: FONT_FAMILY,
        labels: {
          colors: colors.mutedForeground,
        },
      },
      stroke: {
        curve: "smooth",
        lineCap: "round",
      },
      tooltip: {
        theme: mode,
        intersect: false,
        fillSeriesColor: false,
        style: {
          fontFamily: FONT_FAMILY,
          fontSize: "12px",
        },
        marker: {
          show: true,
        },
      },
      xaxis: {
        axisBorder: { color: colors.borderSubtle },
        axisTicks: { color: colors.borderSubtle },
        labels: {
          trim: true,
          style: {
            colors: colors.mutedForeground,
            fontFamily: FONT_FAMILY,
            fontSize: "11px",
          },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          style: {
            colors: colors.mutedForeground,
            fontFamily: FONT_FAMILY,
            fontSize: "11px",
          },
        },
      },
      states: {
        hover: {
          filter: {
            type: "lighten",
            value: mode === "dark" ? 0.08 : 0.04,
          },
        },
        active: {
          filter: {
            type: "none",
          },
        },
      },
    };

    return {
      baseOptions,
      colors,
      currentTheme,
      mode,
      reducedMotion,
      resolvedTheme,
      themeRevision,
    };
  }, [currentTheme, reducedMotion, resolvedTheme, themeRevision]);
};

export const formatChartMinutes = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const formatShortDate = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};
