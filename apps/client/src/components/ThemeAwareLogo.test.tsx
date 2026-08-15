import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BRACK_LOGO_IMAGES } from "@/config/brackAssets";
import { ThemeAwareLogo } from "./ThemeAwareLogo";

afterEach(cleanup);

describe("ThemeAwareLogo", () => {
  it.each([
    ["icon", BRACK_LOGO_IMAGES.icon, "aspect-square", "130%"],
    ["full", BRACK_LOGO_IMAGES.full, "aspect-[418/123]", "100% auto"],
  ] as const)("renders the %s from its transparent canonical mask", (variant, source, aspect, maskSize) => {
    render(<ThemeAwareLogo variant={variant} />);

    const logo = screen.getByRole("img", { name: "Brack" });
    expect(logo.style.maskImage).toBe(`url(${source})`);
    expect(logo.style.maskSize).toBe(maskSize);
    expect(logo).toHaveClass(aspect);
    expect(screen.queryByAltText("Brack")).not.toBeInTheDocument();
  });
});
