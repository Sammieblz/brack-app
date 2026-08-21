import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Progress } from "./progress";

afterEach(cleanup);

describe("Progress", () => {
  it("renders an exact determinate value against a custom maximum", () => {
    render(
      <Progress
        value={42}
        max={200}
        variant="dimensional"
        segments={8}
        aria-label="Import progress"
      />,
    );

    const progress = screen.getByRole("progressbar", { name: "Import progress" });
    const indicator = progress.querySelector<HTMLElement>("[data-slot='progress-indicator']");

    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "200");
    expect(progress).toHaveAttribute("aria-valuenow", "42");
    expect(progress).toHaveAttribute("aria-valuetext", "21%");
    expect(progress).toHaveAttribute("data-variant", "dimensional");
    expect(progress).toHaveAttribute("data-segments", "8");
    expect(progress.style.getPropertyValue("--brack-progress-segments")).toBe("8");
    expect(indicator).toHaveStyle({ width: "21%" });
    expect(progress.querySelectorAll("[data-segment-state]")).toHaveLength(8);
    expect(progress.querySelectorAll("[data-segment-state='complete']")).toHaveLength(1);
    expect(progress.querySelectorAll("[data-segment-state='current']")).toHaveLength(1);
    expect(progress.querySelector<HTMLElement>(".brack-progress__marker-position")?.style.left)
      .toBe("clamp(var(--brack-progress-marker-width), 21%, 100%)");
  });

  it("uses a true indeterminate state when no value is known", () => {
    render(<Progress variant="dimensional" aria-label="Loading your library" />);

    const progress = screen.getByRole("progressbar", { name: "Loading your library" });
    const indicator = progress.querySelector<HTMLElement>("[data-slot='progress-indicator']");

    expect(progress).toHaveAttribute("data-state", "indeterminate");
    expect(progress).not.toHaveAttribute("aria-valuenow");
    expect(progress).not.toHaveAttribute("aria-valuetext");
    expect(indicator).toHaveClass("brack-progress__indicator--indeterminate");
    expect(indicator).toHaveStyle({ width: "38%" });
    expect(progress.querySelector(".brack-progress__track")).toHaveAttribute("aria-hidden", "true");
    expect(progress.querySelector(".brack-progress__marker-position"))
      .toHaveClass("brack-progress__marker-position--indeterminate");
  });

  it("clamps determinate values to the representable range", () => {
    const { rerender } = render(
      <Progress value={125} variant="dimensional" aria-label="Reading progress" />,
    );

    let progress = screen.getByRole("progressbar", { name: "Reading progress" });
    let indicator = progress.querySelector<HTMLElement>("[data-slot='progress-indicator']");
    expect(progress).toHaveAttribute("aria-valuenow", "100");
    expect(progress).toHaveAttribute("data-state", "complete");
    expect(indicator).toHaveStyle({ width: "100%" });

    rerender(<Progress value={-12} variant="dimensional" aria-label="Reading progress" />);
    progress = screen.getByRole("progressbar", { name: "Reading progress" });
    indicator = progress.querySelector<HTMLElement>("[data-slot='progress-indicator']");
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(indicator).toHaveStyle({ width: "0%" });
  });

  it("gives the default variant layered compact visuals without changing its value contract", () => {
    const { rerender } = render(<Progress value={92} className="h-2" />);

    let progress = screen.getByRole("progressbar", { name: "Progress" });
    let indicator = progress.querySelector<HTMLElement>("[data-slot='progress-indicator']");
    const firstCap = progress.querySelector(".brack-progress__cap");

    expect(progress).toHaveAttribute("data-variant", "default");
    expect(progress).toHaveClass("h-2");
    expect(progress).not.toHaveClass("brack-progress--dimensional");
    expect(indicator).toHaveClass("brack-progress__indicator--default");
    expect(indicator).toHaveStyle({ width: "100%", transform: "translateX(-8%)" });
    expect(indicator?.querySelector(".brack-progress__texture")).toBeInTheDocument();
    expect(indicator?.querySelector(".brack-progress__specular")).toBeInTheDocument();
    expect(firstCap).toBeInTheDocument();

    rerender(<Progress value={100} className="h-2" />);
    progress = screen.getByRole("progressbar", { name: "Progress" });
    indicator = progress.querySelector<HTMLElement>("[data-slot='progress-indicator']");
    expect(progress).toHaveAttribute("data-state", "complete");
    expect(indicator).toHaveStyle({ width: "100%", transform: "translateX(-0%)" });
    expect(progress.querySelector(".brack-progress__cap")).not.toBe(firstCap);
  });

  it("keeps the dimensional marker and nodes safe at 0, 1, 99, and 100 percent", () => {
    const { rerender } = render(
      <Progress value={0} variant="dimensional" segments={4} aria-label="Boundary progress" />,
    );

    const getParts = () => {
      const progress = screen.getByRole("progressbar", { name: "Boundary progress" });
      return {
        progress,
        indicator: progress.querySelector<HTMLElement>("[data-slot='progress-indicator']"),
        markerPosition: progress.querySelector<HTMLElement>(".brack-progress__marker-position"),
        marker: progress.querySelector<HTMLElement>(".brack-progress__marker"),
      };
    };

    let parts = getParts();
    expect(parts.progress).toHaveAttribute("data-empty", "true");
    expect(parts.indicator).toHaveStyle({ width: "0%" });
    expect(parts.markerPosition).toHaveAttribute("data-empty", "true");
    expect(parts.markerPosition?.style.left)
      .toBe("clamp(var(--brack-progress-marker-width), 0%, 100%)");
    expect(parts.progress.querySelectorAll("[data-segment-state='upcoming']")).toHaveLength(4);

    rerender(
      <Progress value={1} variant="dimensional" segments={4} aria-label="Boundary progress" />,
    );
    parts = getParts();
    const onePercentMarker = parts.marker;
    expect(parts.progress).not.toHaveAttribute("data-empty");
    expect(parts.indicator).toHaveStyle({ width: "1%" });
    expect(parts.markerPosition?.style.left)
      .toBe("clamp(var(--brack-progress-marker-width), 1%, 100%)");
    expect(parts.progress.querySelectorAll("[data-segment-state='current']")).toHaveLength(1);

    rerender(
      <Progress value={99} variant="dimensional" segments={4} aria-label="Boundary progress" />,
    );
    parts = getParts();
    expect(parts.indicator).toHaveStyle({ width: "99%" });
    expect(parts.markerPosition?.style.left)
      .toBe("clamp(var(--brack-progress-marker-width), 99%, 100%)");
    expect(parts.progress.querySelectorAll("[data-segment-state='complete']")).toHaveLength(3);
    expect(parts.progress.querySelectorAll("[data-segment-state='current']")).toHaveLength(1);
    expect(parts.marker).not.toBe(onePercentMarker);

    rerender(
      <Progress value={100} variant="dimensional" segments={4} aria-label="Boundary progress" />,
    );
    parts = getParts();
    expect(parts.progress).toHaveAttribute("data-state", "complete");
    expect(parts.indicator).toHaveStyle({ width: "100%" });
    expect(parts.markerPosition).toHaveAttribute("data-complete", "true");
    expect(parts.markerPosition?.style.left)
      .toBe("clamp(var(--brack-progress-marker-width), 100%, 100%)");
    expect(parts.progress.querySelectorAll("[data-segment-state='complete']")).toHaveLength(4);
    expect(parts.progress.querySelectorAll("[data-segment-state='current']")).toHaveLength(0);
  });

  it("aligns integer step values with their exact segment boundary", () => {
    render(
      <Progress value={4} max={6} variant="dimensional" segments={6} aria-label="Step progress" />,
    );

    const progress = screen.getByRole("progressbar", { name: "Step progress" });
    expect(progress.querySelectorAll("[data-segment-state='complete']")).toHaveLength(3);
    expect(progress.querySelectorAll("[data-segment-state='current']")).toHaveLength(1);
    expect(progress.querySelector("[data-segment-state='current']"))
      .toHaveTextContent("4");
  });

  it("supports contextual value text and hidden decorative previews", () => {
    const { container } = render(
      <>
        <Progress
          value={2}
          max={6}
          aria-label="Setup progress"
          getValueLabel={(step, total) => `Step ${step} of ${total}`}
        />
        <Progress value={67} variant="dimensional" aria-hidden="true" />
      </>,
    );

    const setupProgress = screen.getByRole("progressbar", { name: "Setup progress" });
    expect(setupProgress).toHaveAttribute("aria-valuenow", "2");
    expect(setupProgress).toHaveAttribute("aria-valuemax", "6");
    expect(setupProgress).toHaveAttribute("aria-valuetext", "Step 2 of 6");
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(container.querySelector("[aria-hidden='true'][data-slot='progress']"))
      .toBeInTheDocument();
  });
});
