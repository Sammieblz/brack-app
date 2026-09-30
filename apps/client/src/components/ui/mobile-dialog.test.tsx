import { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileAlertDialog, MobileDialog } from "./mobile-dialog";

vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("adaptive task descriptions", () => {
  for (const kind of ["task", "confirmation"] as const) {
    const surface = (description?: string) => kind === "task"
      ? <MobileDialog open onOpenChange={() => undefined} title="Reading task" description={description}><p>Task content</p></MobileDialog>
      : <MobileAlertDialog open onOpenChange={() => undefined} title="Reading task" description={description} onConfirm={() => undefined} />;

    it(`${kind} uses the real Radix description relationship without a missing-description warning`, () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const view = render(surface("Keep your reading work."));
      const dialog = screen.getByRole("dialog", { name: "Reading task" });
      const descriptionId = dialog.getAttribute("aria-describedby");
      expect(descriptionId).toBeTruthy();
      expect(document.getElementById(descriptionId!)).toBe(screen.getByText("Keep your reading work."));
      expect(dialog).toHaveAccessibleDescription("Keep your reading work.");
      expect(warn).not.toHaveBeenCalled();

      view.rerender(surface());
      expect(dialog).not.toHaveAttribute("aria-describedby");
      expect(dialog).toHaveAccessibleDescription("");
      expect(document.getElementById(descriptionId!)).toBeNull();
      expect(warn).not.toHaveBeenCalled();

      view.rerender(surface("Updated reading instructions."));
      expect(dialog).toHaveAccessibleDescription("Updated reading instructions.");
      expect(document.getElementById(dialog.getAttribute("aria-describedby")!)).toBe(screen.getByText("Updated reading instructions."));
      expect(warn).not.toHaveBeenCalled();
    });

    it(`${kind} omits the description relationship when no description is supplied`, () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      render(surface());
      const dialog = screen.getByRole("dialog", { name: "Reading task" });
      expect(dialog).not.toHaveAttribute("aria-describedby");
      expect(dialog).toHaveAccessibleDescription("");
      expect(warn).not.toHaveBeenCalled();
    });
  }
});

describe("adaptive confirmation focus", () => {
  it("honors Escape as soon as the safe action receives initial focus", async () => {
    const close = vi.fn();
    const confirm = vi.fn();
    const immediateEscape = (event: FocusEvent) => {
      if (event.target instanceof HTMLButtonElement && event.target.textContent === "Keep editing") {
        event.target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      }
    };
    document.addEventListener("focusin", immediateEscape);
    try {
      function Confirmation() {
        const [open, setOpen] = useState(true);
        return <MobileAlertDialog open={open} onOpenChange={next => { close(next); setOpen(next); }}
          title="Discard this draft?" cancelText="Keep editing" onConfirm={confirm} />;
      }
      render(<Confirmation />);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(close).toHaveBeenCalledExactlyOnceWith(false);
      expect(confirm).not.toHaveBeenCalled();
    } finally { document.removeEventListener("focusin", immediateEscape); }
  });

  it("Escape dismisses only the nested dialog and leaves its confirmation open", async () => {
    const close = vi.fn();
    function Confirmation() {
      const [nested, setNested] = useState(false);
      return <MobileAlertDialog open onOpenChange={close} title="Discard this draft?" onConfirm={() => undefined}>
        <button onClick={() => setNested(true)}>Inspect details</button>
        <MobileDialog open={nested} onOpenChange={setNested} title="Draft details"><button>Review details</button></MobileDialog>
      </MobileAlertDialog>;
    }
    render(<Confirmation />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect details" }));
    const nestedAction = screen.getByRole("button", { name: "Review details" });
    nestedAction.focus();
    fireEvent.keyDown(nestedAction, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Draft details" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Discard this draft?" })).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });

  it.each(["Cancel", "Close", "Escape"])("returns %s dismissal to the actual external invoker without confirming", async (method) => {
    const confirm = vi.fn();
    function Confirmation() {
      const [open, setOpen] = useState(false);
      const invoker = useRef<HTMLButtonElement>(null);
      return <><button ref={invoker} onClick={() => setOpen(true)}>Remove selected books</button>
        <MobileAlertDialog open={open} onOpenChange={setOpen} returnFocusRef={invoker}
          title="Remove these books?" description="These books leave your library."
          confirmText="Remove" onConfirm={confirm} />
      </>;
    }
    render(<Confirmation />);
    const invoker = screen.getByRole("button", { name: "Remove selected books" });
    // Pointer activation in Safari need not focus an external invoker.
    fireEvent.click(invoker);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("These books leave your library.");
    if (method === "Escape") fireEvent.keyDown(document, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: method }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(invoker).toHaveFocus());
    expect(confirm).not.toHaveBeenCalled();
  });
});
