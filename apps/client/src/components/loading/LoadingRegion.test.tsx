import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoadingError, LoadingRegion } from "./LoadingRegion";
import { Skeleton } from "@/components/ui/skeleton";

describe("LoadingRegion", () => {
  it("announces once outside its busy content and hides decorative placeholders", () => {
    const { container } = render(<LoadingRegion loading label="Loading books"><Skeleton><button>Not a real action</button></Skeleton><Skeleton /></LoadingRegion>);
    const busy = container.querySelector('[aria-busy="true"]')!;
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(busy.contains(screen.getByRole("status"))).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("Loading books");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    container.querySelectorAll("[data-skeleton]").forEach((node) => {
      expect(node).toHaveAttribute("inert");
      expect(node).toHaveAttribute("aria-hidden", "true");
      expect(node).toHaveAttribute("tabindex", "-1");
      expect(node.className).not.toContain("animate-pulse");
    });
  });

  it("preserves cached children, focus and form state throughout refresh", () => {
    const view = (refreshing: boolean) => <LoadingRegion loading={false} refreshing={refreshing} label="Loading books"><input aria-label="Filter books" defaultValue="fiction" /></LoadingRegion>;
    const { rerender, container } = render(view(false));
    const input = screen.getByRole("textbox");
    input.focus();
    fireEvent.change(input, { target: { value: "poetry" } });
    rerender(view(true));
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("poetry");
    expect(container.querySelector("[data-refresh-indicator]")).toHaveTextContent("Updating");
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    rerender(view(false));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(container.querySelector("[data-refresh-indicator]")).toBeNull();
  });

  it("does not invent skeletons for known-empty or failed states", () => {
    const retry = vi.fn();
    const { container, rerender } = render(<LoadingRegion loading={false} label="Loading lists"><p>No lists yet</p></LoadingRegion>);
    expect(screen.getByText("No lists yet")).toBeVisible();
    expect(container.querySelector("[data-skeleton]")).toBeNull();
    rerender(<LoadingRegion loading={false} label="Loading lists"><LoadingError message="Lists could not load." onRetry={retry} /></LoadingRegion>);
    expect(screen.getByRole("alert")).toHaveTextContent("Lists could not load.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
