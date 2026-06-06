import { useEffect, useState, type CSSProperties } from "react";
import { Check } from "iconoir-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { themes, type Theme, type ThemeColors } from "@/lib/themes";
import { cn } from "@/lib/utils";

const surfaceStyleLabels: Record<NonNullable<Theme["surfaceStyle"]>, string> = {
  standard: "Classic color",
  paper: "Paper texture",
  glass: "Glass surfaces",
  comic: "Panel outlines",
  "coloring-book": "Outlined pages",
};

const hsl = (value: string, alpha?: number) =>
  alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;

const getPreviewFrameStyle = (theme: Theme, colors: ThemeColors): CSSProperties => {
  const surfaceStyle = theme.surfaceStyle ?? "standard";
  const base: CSSProperties = {
    backgroundColor: hsl(colors.background),
    borderColor: hsl(colors.border),
    color: hsl(colors.foreground),
  };

  if (surfaceStyle === "paper") {
    return {
      ...base,
      backgroundImage: `linear-gradient(90deg, transparent 0, transparent 26%, ${hsl(colors.destructive, 0.08)} 27%, transparent 28%), repeating-linear-gradient(0deg, transparent 0 17px, ${hsl(colors.primary, 0.08)} 18px, transparent 19px), radial-gradient(circle at 1px 1px, ${hsl(colors.foreground, 0.05)} 1px, transparent 0), ${colors.gradientCard}`,
      backgroundSize: "100% 100%, 100% 19px, 12px 12px, 100% 100%",
      boxShadow: colors.shadowSoft,
    };
  }

  if (surfaceStyle === "glass") {
    return {
      ...base,
      backgroundColor: hsl(colors.card, 0.62),
      backgroundImage: `linear-gradient(145deg, hsl(0 0% 100% / 0.22), transparent 44%), ${colors.gradientCard}`,
      backdropFilter: "blur(10px) saturate(1.2)",
      boxShadow: colors.shadowSoft,
    };
  }

  if (surfaceStyle === "comic") {
    return {
      ...base,
      borderColor: hsl(colors.border),
      borderWidth: 2,
      boxShadow: colors.shadowSoft,
    };
  }

  if (surfaceStyle === "coloring-book") {
    return {
      ...base,
      backgroundImage: `linear-gradient(0deg, ${hsl(colors.border, 0.04)} 1px, transparent 1px), linear-gradient(90deg, ${hsl(colors.border, 0.04)} 1px, transparent 1px), ${colors.gradientCard}`,
      backgroundSize: "14px 14px, 14px 14px, 100% 100%",
      borderColor: hsl(colors.border, 0.82),
      borderWidth: 2,
      boxShadow: "none",
    };
  }

  return {
    ...base,
    backgroundImage: colors.gradientCard,
    boxShadow: colors.shadowSoft,
  };
};

interface ThemePaletteCarouselProps {
  selectedTheme: string;
  previewMode?: "light" | "dark";
  onSelectTheme: (themeId: string) => void | Promise<void>;
  className?: string;
  ariaLabel?: string;
}

export const ThemePaletteCarousel = ({
  selectedTheme,
  previewMode = "light",
  onSelectTheme,
  className,
  ariaLabel = "Theme appearance options",
}: ThemePaletteCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedSnap, setSelectedSnap] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    const updateCarouselState = () => {
      setSelectedSnap(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
    };

    updateCarouselState();
    api.on("select", updateCarouselState);
    api.on("reInit", updateCarouselState);

    return () => {
      api.off("select", updateCarouselState);
      api.off("reInit", updateCarouselState);
    };
  }, [api]);

  useEffect(() => {
    if (!api) return;

    const selectedIndex = themes.findIndex((theme) => theme.id === selectedTheme);
    if (selectedIndex >= 0) {
      api.scrollTo(selectedIndex);
    }
  }, [api, selectedTheme]);

  return (
    <div className={cn("min-w-0 max-w-full space-y-3 overflow-hidden", className)}>
      <Carousel
        setApi={setApi}
        opts={{ align: "start", containScroll: "trimSnaps" }}
        className="group/theme-carousel min-w-0 max-w-full"
        aria-label={ariaLabel}
      >
        <CarouselContent className="-ml-2 py-1">
          {themes.map((theme) => {
            const selected = selectedTheme === theme.id;
            const previewColors = theme.colors[previewMode];
            const surfaceStyle = theme.surfaceStyle ?? "standard";

            return (
              <CarouselItem
                key={theme.id}
                className="basis-[86%] pl-2 sm:basis-[17rem] lg:basis-[17.5rem]"
              >
                <button
                  type="button"
                  onClick={() => void onSelectTheme(theme.id)}
                  className={cn(
                    "group/card relative flex h-full min-h-[13.75rem] w-full flex-col overflow-hidden rounded-lg border bg-background/80 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    selected ? "border-primary bg-primary/10 shadow-sm" : "border-border"
                  )}
                  aria-pressed={selected}
                >
                  <span
                    className={cn(
                      "absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-transform group-hover/card:scale-110",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted"
                    )}
                    aria-hidden="true"
                  >
                    {selected && <Check className="h-4 w-4" />}
                  </span>

                  <div className="relative z-10 flex h-full flex-col gap-2.5 pr-8">
                    <div>
                      <h3 className="font-sans text-sm font-semibold">{theme.name}</h3>
                      <p className="font-sans text-xs text-muted-foreground">
                        {theme.id === "default" ? "Brack classic" : surfaceStyleLabels[surfaceStyle]}
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {theme.preview.map((color) => (
                        <span
                          key={color}
                          className="h-4 rounded-sm border border-black/5 shadow-sm transition-transform duration-300 group-hover/card:-translate-y-0.5"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>

                    <div
                      className="mt-auto overflow-hidden rounded-md border shadow-sm"
                      style={getPreviewFrameStyle(theme, previewColors)}
                    >
                      <div
                        className="flex h-5 items-center gap-1 border-b px-2"
                        style={{
                          backgroundColor: hsl(previewColors.card, surfaceStyle === "glass" ? 0.62 : 1),
                          borderColor: hsl(previewColors.border),
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.preview[0] }} />
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.preview[1] }} />
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.preview[2] }} />
                        <span
                          className="ml-auto h-1.5 w-10 rounded-full"
                          style={{ backgroundColor: hsl(previewColors.muted) }}
                        />
                      </div>
                      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)]">
                        <div
                          className="space-y-1 border-r p-1"
                          style={{
                            backgroundColor: hsl(previewColors.muted, surfaceStyle === "glass" ? 0.58 : 1),
                            borderColor: hsl(previewColors.border),
                          }}
                        >
                          <span
                            className="block h-3.5 rounded-sm"
                            style={{ backgroundColor: hsl(previewColors.primary) }}
                          />
                          <span
                            className="block h-3.5 rounded-sm opacity-65"
                            style={{ backgroundColor: hsl(previewColors.card) }}
                          />
                          <span
                            className="block h-3.5 rounded-sm opacity-65"
                            style={{ backgroundColor: hsl(previewColors.card) }}
                          />
                        </div>
                        <div className="space-y-1.5 p-1.5">
                          <span
                            className="block h-1.5 w-3/5 rounded-full"
                            style={{ backgroundColor: hsl(previewColors.primary) }}
                          />
                          <span
                            className="block h-1.5 w-full rounded-full"
                            style={{ backgroundColor: hsl(previewColors.muted) }}
                          />
                          <span
                            className="block h-1.5 w-4/5 rounded-full"
                            style={{ backgroundColor: hsl(previewColors.secondary) }}
                          />
                          <div className="grid grid-cols-3 gap-1 pt-0.5">
                            <span className="h-5 rounded-sm" style={{ backgroundColor: theme.preview[0] }} />
                            <span className="h-5 rounded-sm" style={{ backgroundColor: theme.preview[1] }} />
                            <span className="h-5 rounded-sm" style={{ backgroundColor: theme.preview[2] }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-5"
                    style={{
                      background: `linear-gradient(135deg, ${hsl(previewColors.primary)}, ${hsl(previewColors.secondary)})`,
                    }}
                  />
                </button>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <CarouselPrevious className="static h-8 w-8 translate-y-0 border-border bg-background/90 text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75 disabled:opacity-35" />

          <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
            {snapCount > 1 && (
              <div className="flex items-center gap-1">
                {Array.from({ length: snapCount }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => api?.scrollTo(index)}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selectedSnap === index && "bg-primary/10"
                    )}
                    aria-label={`Go to theme ${index + 1}`}
                    aria-current={selectedSnap === index ? "true" : undefined}
                  >
                    <span
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        selectedSnap === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/35"
                      )}
                    />
                  </button>
                ))}
              </div>
            )}

            {snapCount > 0 && (
              <p className="hidden shrink-0 font-sans text-xs text-muted-foreground sm:block">
                {selectedSnap + 1} of {snapCount}
              </p>
            )}
          </div>

          <CarouselNext className="static h-8 w-8 translate-y-0 border-border bg-background/90 text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75 disabled:opacity-35" />
        </div>
      </Carousel>
    </div>
  );
};
