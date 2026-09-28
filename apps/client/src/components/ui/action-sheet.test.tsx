import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOverlayBack } from "@/lib/backLayers";
import { ActionSheet } from "./action-sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

const feedback = vi.hoisted(() => ({ trigger: vi.fn() }));
vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: ({ enabled = true } = {}) => ({ triggerHaptic: enabled ? feedback.trigger : () => undefined }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ActionSheet ownership", () => {
  it.each(["action", "cancel", "app-back"])("closes an uncontrolled sheet through %s and restores its trigger", async (dismissal) => {
    const action = vi.fn();
    render(<ActionSheet trigger={<button>Book options</button>} actions={[{ label: "Edit book", onClick: action }]} />);
    const trigger = screen.getByRole("button", { name: "Book options" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Actions" })).toBeInTheDocument();
    if (dismissal === "action") fireEvent.click(screen.getByRole("button", { name: "Edit book" }));
    if (dismissal === "cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    if (dismissal === "app-back") act(() => { expect(requestOverlayBack()).toBe(true); });
    expect(action).toHaveBeenCalledTimes(dismissal === "action" ? 1 : 0);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps a controlled close veto on its owner and preserves the accessible description", () => {
    const onOpenChange = vi.fn();
    render(<ActionSheet open onOpenChange={onOpenChange} title="Book options" description="Choose what to do with this book." actions={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.getByRole("dialog", { name: "Book options" })).toHaveAccessibleDescription("Choose what to do with this book.");
  });

  it("separates destructive actions without duplicating opening feedback", async () => {
    const remove = vi.fn();
    render(<ActionSheet trigger={<button>Open options</button>} openHaptic={false} actions={[
      { label: "Share book", onClick: vi.fn() },
      { label: "Remove book", onClick: remove, variant: "destructive" },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open options" }));
    expect(feedback.trigger).not.toHaveBeenCalled();
    const destructive = screen.getByRole("group", { name: "Destructive actions" });
    expect(within(destructive).queryByRole("button", { name: "Share book" })).not.toBeInTheDocument();
    fireEvent.click(within(destructive).getByRole("button", { name: "Remove book" }));
    expect(remove).toHaveBeenCalledOnce();
    expect(feedback.trigger).toHaveBeenCalledExactlyOnceWith("selection");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("restores an external pointer invoker when no DialogTrigger is present", async () => {
    function ControlledSheet() {
      const [open, setOpen] = useState(false);
      const trigger = useRef<HTMLButtonElement>(null);
      return <><button ref={trigger} onClick={() => setOpen(true)}>Post options</button>
        <ActionSheet open={open} onOpenChange={setOpen} returnFocusRef={trigger} actions={[]} />
      </>;
    }
    render(<ControlledSheet />);
    // A touch/Safari click need not give the invoker focus before presentation.
    const trigger = screen.getByRole("button", { name: "Post options" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps focus in a confirmation opened by an action during sheet dismissal", async () => {
    vi.useFakeTimers();
    function Handoff() {
      const [open, setOpen] = useState(false);
      const [confirm, setConfirm] = useState(false);
      const trigger = useRef<HTMLButtonElement>(null);
      return <><button ref={trigger} onClick={() => setOpen(true)}>Post options</button>
        <ActionSheet open={open} onOpenChange={setOpen} returnFocusRef={trigger}
          actions={[{ label: "Delete post", variant: "destructive", onClick: () => setConfirm(true) }]} />
        <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent>
          <DialogTitle>Delete this post?</DialogTitle><DialogDescription>Confirm removing this post.</DialogDescription>
          <button>Keep post</button><button>Confirm delete</button>
        </DialogContent></Dialog>
      </>;
    }
    render(<Handoff />);
    const invoker = screen.getByRole("button", { name: "Post options" });
    fireEvent.click(invoker);
    const restoreInvoker = vi.spyOn(invoker, "focus");
    fireEvent.click(screen.getByRole("button", { name: "Delete post" }));
    // Radix schedules unmount autofocus. Flush that lifecycle before checking
    // the new focus scope, rather than observing only its initial autofocus.
    await act(async () => { vi.runOnlyPendingTimers(); });
    expect(screen.queryByRole("dialog", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep post" })).toHaveFocus();
    expect(restoreInvoker).not.toHaveBeenCalled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
