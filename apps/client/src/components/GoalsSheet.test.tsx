import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoalsSheet } from "./GoalsSheet";
import { requestOverlayBack } from "@/lib/backLayers";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader" } }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/hooks/useGoals", () => ({ useGoals: () => ({
  goals: [], activeGoals: [], loading: false, refreshing: false, hasLoaded: true, error: null,
  refetch: vi.fn(), createGoal: vi.fn(), deleteGoal: vi.fn(), completeGoal: vi.fn(),
}) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const resize = (width: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  fireEvent(window, new Event("resize"));
};
beforeEach(() => { resize(390); });
afterEach(() => { cleanup(); resize(1024); });

describe("GoalsSheet dismissal ownership", () => {
  it.each([390, 1280])("keeps app Back, Escape and visible Close on the controlled owner (width=%s)", async (width) => {
    resize(width);
    render(<GoalsSheet />);
    const trigger = screen.getByRole("button", { name: "Goals" });
    for (const dismissal of ["app-back", "escape", "close"]) {
      trigger.focus();
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog", { name: "Reading Goals" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Goal" })).toBeInTheDocument();
      if (dismissal === "app-back") act(() => { expect(requestOverlayBack()).toBe(true); });
      if (dismissal === "escape") fireEvent.keyDown(document, { key: "Escape" });
      if (dismissal === "close") fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(requestOverlayBack()).toBe(false);
    }
  });

  it("retains the real nested goal draft, date text and focus when presentation changes", async () => {
    render(<GoalsSheet />);
    fireEvent.click(screen.getByRole("button", { name: "Goals" }));
    const parent = screen.getByRole("dialog", { name: "Reading Goals" });
    fireEvent.click(screen.getByRole("button", { name: "Create Goal" }));
    const create = screen.getByRole("dialog", { name: "Create New Goal" });
    const target = screen.getByRole("spinbutton", { name: "Target" });
    const date = screen.getByRole("textbox", { name: "Start Date" });
    fireEvent.change(target, { target: { value: "24" } });
    fireEvent.change(date, { target: { value: "02/" } });
    date.focus();
    for (const width of [834, 1280, 390]) {
      act(() => resize(width));
      expect(screen.getByRole("dialog", { name: "Create New Goal" })).toBe(create);
      expect(parent.isConnected).toBe(true);
      expect(target).toHaveValue(24);
      expect(date).toHaveValue("02/");
      expect(date).toHaveFocus();
      expect(create).toHaveAttribute("data-presentation", width === 390 ? "sheet" : "center");
    }
    act(() => { expect(requestOverlayBack()).toBe(true); });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create New Goal" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Reading Goals" })).toBe(parent);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create Goal" })).toHaveFocus());
  });
});
