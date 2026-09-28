import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoalsSheet } from "./GoalsSheet";
import { requestOverlayBack } from "@/lib/backLayers";

const mobile = vi.hoisted(() => ({ current: true }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader" } }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.current }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/components/GoalManager", () => ({ GoalManager: () => <p>Saved reading goals</p> }));

beforeEach(() => { mobile.current = true; });

describe("GoalsSheet dismissal ownership", () => {
  it.each([true, false])("keeps app Back, Escape and visible Close on the controlled owner (mobile=%s)", async (isMobile) => {
    mobile.current = isMobile;
    render(<GoalsSheet />);
    const trigger = screen.getByRole("button", { name: "Goals" });
    for (const dismissal of ["app-back", "escape", "close"]) {
      trigger.focus();
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog", { name: "Reading Goals" })).toBeInTheDocument();
      expect(screen.getByText("Saved reading goals")).toBeInTheDocument();
      if (dismissal === "app-back") act(() => { expect(requestOverlayBack()).toBe(true); });
      if (dismissal === "escape") fireEvent.keyDown(document, { key: "Escape" });
      if (dismissal === "close") fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(requestOverlayBack()).toBe(false);
    }
  });
});
