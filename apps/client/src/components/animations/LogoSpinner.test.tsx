import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRACK_MARK_IMAGE } from "@/config/brackAssets";
import { LogoSpinner } from "@/components/animations/LogoSpinner";
import LoadingSpinner from "@/components/LoadingSpinner";

const reducedMotionMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: reducedMotionMock,
}));

describe("LogoSpinner", () => {
  beforeEach(() => {
    reducedMotionMock.mockReturnValue(false);
  });

  afterEach(cleanup);

  it("exposes one polite loading status without announcing decorative branding", () => {
    render(<LogoSpinner text="Loading your library..." />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).not.toHaveAttribute("aria-busy");
    expect(status).toHaveTextContent("Loading your library...");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses the existing transparent mark as the decorative mask", () => {
    const { container } = render(<LogoSpinner />);
    const status = screen.getByRole("status");

    expect(status.style.getPropertyValue("--brack-loader-mark"))
      .toBe(`url(${BRACK_MARK_IMAGE})`);
    expect(container.querySelector(".brack-loader__mark-art")).toBeInTheDocument();
    expect(container.querySelectorAll(".brack-loader__page")).toHaveLength(2);
    expect(container.querySelector(".brack-loader__orbit")).toBeInTheDocument();
    expect(container.querySelector(".brack-loader__shadow")).toBeInTheDocument();
  });

  it("does not add a focus target or interactive control while loading", () => {
    const { container } = render(<LogoSpinner text="Loading" />);
    const status = screen.getByRole("status");

    expect(status).not.toHaveAttribute("tabindex");
    expect(container.querySelector("button, a, input, select, textarea")).toBeNull();
  });

  it("provides a screen-reader loading label when no visible text is requested", () => {
    render(<LogoSpinner />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading...");
    expect(screen.getByText("Loading...")).toHaveClass("sr-only");
  });

  it.each(["sm", "md", "lg"] as const)("preserves the %s public size variant", (size) => {
    render(<LogoSpinner size={size} text={`${size} loader`} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-size", size);
    cleanup();
  });

  it("reacts to the shared reduced-motion preference", () => {
    const { rerender } = render(<LogoSpinner text="Loading" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-motion", "full");

    reducedMotionMock.mockReturnValue(true);
    rerender(<LogoSpinner text="Loading" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-motion", "reduced");
  });

  it("bounds decorative motion instead of looping beside usable content forever", () => {
    render(<LogoSpinner text="Loading" />);

    const status = screen.getByRole("status");
    const motionLimit = Number(status.getAttribute("data-motion-limit-ms"));
    expect(status.style.getPropertyValue("--brack-loader-motion-iterations")).toBe("2");
    expect(status.style.getPropertyValue("--brack-loader-orbit-duration")).toBe("2400ms");
    expect(motionLimit).toBeGreaterThan(0);
    expect(motionLimit).toBeLessThanOrEqual(5_000);
  });

  it("keeps caller classes on the loader root", () => {
    render(<LogoSpinner className="custom-loader-placement" />);
    expect(screen.getByRole("status")).toHaveClass("brack-loader", "custom-loader-placement");
  });
});

describe("LoadingSpinner compatibility", () => {
  beforeEach(() => {
    reducedMotionMock.mockReturnValue(false);
  });

  afterEach(cleanup);

  it("retains its default label and forwards size and custom text", () => {
    const { rerender } = render(<LoadingSpinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    expect(screen.getByRole("status")).toHaveAttribute("data-size", "md");

    rerender(<LoadingSpinner size="lg" text="Preparing your Reader Journey..." />);
    expect(screen.getByRole("status")).toHaveAttribute("data-size", "lg");
    expect(screen.getByRole("status")).toHaveTextContent("Preparing your Reader Journey...");
  });
});
