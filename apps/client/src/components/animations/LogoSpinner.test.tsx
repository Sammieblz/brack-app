import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRACK_MARK_IMAGE } from "@/config/brackAssets";
import {
  BrackLoader,
  LogoSpinner,
} from "@/components/animations/LogoSpinner";
import { BRACK_LOADER_TIMING } from "@/components/animations/brackLoaderTokens";
import LoadingSpinner from "@/components/LoadingSpinner";

const reducedMotionMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: reducedMotionMock,
}));

describe("BrackLoader", () => {
  beforeEach(() => {
    reducedMotionMock.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("exposes one polite loading status without announcing decorative branding", () => {
    render(<BrackLoader label="Loading your library..." delayMs={0} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("Loading your library...");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses the transparent Brack mark on a layered hardcover book", () => {
    const { container } = render(<BrackLoader delayMs={0} />);
    const status = screen.getByRole("status");

    expect(status.style.getPropertyValue("--brack-loader-mark"))
      .toBe(`url(${BRACK_MARK_IMAGE})`);
    expect(container.querySelector(".brack-loader__book")).toBeInTheDocument();
    expect(container.querySelectorAll(".brack-loader__cover")).toHaveLength(2);
    expect(container.querySelectorAll(".brack-loader__page")).toHaveLength(2);
    expect(container.querySelector(".brack-loader__page-block")).toBeInTheDocument();
    expect(container.querySelector(".brack-loader__turning-page")).toBeInTheDocument();
    expect(container.querySelector(".brack-loader__spine")).toBeInTheDocument();
    expect(container.querySelector(".brack-loader__mark-art")).toBeInTheDocument();
    expect(container.querySelector(".brack-loader__page-mark")).toBeInTheDocument();
    expect(container.querySelector(".brack-loader__cover-inlay")).toBeInTheDocument();
  });

  it("does not add a focus target or interactive control while loading", () => {
    const { container } = render(<BrackLoader label="Loading" delayMs={0} />);
    expect(screen.getByRole("status")).not.toHaveAttribute("tabindex");
    expect(container.querySelector("button, a, input, select, textarea")).toBeNull();
  });

  it("waits through the appearance threshold and disappears immediately on completion", () => {
    vi.useFakeTimers();
    const { rerender } = render(<BrackLoader active label="Loading books" />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(BRACK_LOADER_TIMING.appearanceDelayMs - 1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toHaveTextContent("Loading books");

    rerender(<BrackLoader active={false} label="Loading books" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["compact", "inline", "section", "fullscreen"] as const)(
    "shares the same visual system with the %s placement variant",
    (variant) => {
      render(<BrackLoader variant={variant} label={`${variant} loader`} delayMs={0} />);
      expect(screen.getByRole("status")).toHaveAttribute("data-variant", variant);
      expect(document.querySelector(".brack-loader__book")).toBeInTheDocument();
      cleanup();
    },
  );

  it("uses a calm static book for reduced motion", () => {
    reducedMotionMock.mockReturnValue(true);
    render(<BrackLoader label="Loading" delayMs={0} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-motion", "reduced");
  });

  it("uses the calm static state when the browser requests reduced data", () => {
    const matchMedia = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      ...matchMedia(query),
      matches: query === "(prefers-reduced-data: reduce)",
    }));

    render(<BrackLoader label="Loading" delayMs={0} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-motion", "calm");
  });

  it("pauses when the document is hidden and removes animation hints after settling", () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    render(<BrackLoader label="Loading" delayMs={0} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-motion", "full");
    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("status")).toHaveAttribute("data-motion", "paused");

    act(() => vi.advanceTimersByTime(BRACK_LOADER_TIMING.motionDurationMs));
    expect(screen.getByRole("status")).toHaveAttribute("data-motion", "settled");
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-motion-limit-ms",
      String(BRACK_LOADER_TIMING.motionDurationMs),
    );
  });

  it("clamps real progress and omits indeterminate progress", () => {
    const { rerender } = render(
      <BrackLoader label="Importing books" progress={140} delayMs={0} />,
    );
    expect(screen.getByRole("progressbar", { name: "Loading progress" }))
      .toHaveAttribute("aria-valuenow", "100");

    rerender(<BrackLoader label="Opening library" delayMs={0} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("loader compatibility", () => {
  afterEach(cleanup);

  it("retains LogoSpinner's screen-reader-only fallback label", () => {
    render(<LogoSpinner delayMs={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    expect(screen.getByText("Loading...")).toHaveClass("sr-only");
  });

  it("forwards LoadingSpinner placement, size and operation text", () => {
    render(
      <LoadingSpinner
        variant="section"
        size="lg"
        text="Preparing your Reader Journey..."
        delayMs={0}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("data-variant", "section");
    expect(screen.getByRole("status")).toHaveAttribute("data-size", "lg");
    expect(screen.getByRole("status")).toHaveTextContent("Preparing your Reader Journey...");
  });
});
