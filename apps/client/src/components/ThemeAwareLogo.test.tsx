import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BRACK_LOGO_IMAGES } from "@/config/brackAssets";
import { ThemeAwareLogo } from "./ThemeAwareLogo";

const logoStyles = readFileSync(resolve(__dirname, "theme-aware-logo.css"), "utf8");

afterEach(cleanup);

describe("ThemeAwareLogo", () => {
  it.each([
    ["icon", BRACK_LOGO_IMAGES.icon, "aspect-square", "130%"],
    ["full", BRACK_LOGO_IMAGES.full, "aspect-[4/1]", "contain"],
  ] as const)("renders the %s from its transparent canonical mask", (variant, source, aspect, maskSize) => {
    render(<ThemeAwareLogo variant={variant} />);

    const logo = screen.getByRole("img", { name: "Brack" });
    expect(logo.style.maskImage).toBe(`url(${source})`);
    expect(logo.style.maskSize).toBe(maskSize);
    expect(logo).toHaveClass(aspect);
    expect(screen.queryByAltText("Brack")).not.toBeInTheDocument();
  });

  it("inherits the selected palette instead of baking a campaign color into the logo", () => {
    render(<ThemeAwareLogo variant="full" />);

    const logo = screen.getByRole("img", { name: "Brack" });
    expect(logo).toHaveClass("brack-logo");
    expect(logo.style.background).toBe("");
    expect(logoStyles).toContain("background-color: hsl(var(--primary))");
    expect(logoStyles).toContain("background-image: var(--gradient-primary)");
    expect(logo.style.maskImage).toBe(`url(${BRACK_LOGO_IMAGES.full})`);
  });

  it("keeps the same silhouette visible in forced-color mode", () => {
    expect(logoStyles).toContain("@media (forced-colors: active)");
    expect(logoStyles).toContain("forced-color-adjust: none");
    expect(logoStyles).toContain("background: CanvasText");
  });

  it("accepts compact responsive sizes without applying default header heights", () => {
    render(<ThemeAwareLogo variant="full" size="h-8 sm:h-9" className="align-middle" />);

    const logo = screen.getByRole("img", { name: "Brack" });
    expect(logo).toHaveClass("h-8", "sm:h-9", "align-middle");
    expect(logo).not.toHaveClass("h-12", "md:h-14");
  });
});
