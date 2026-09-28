import { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileAlertDialog } from "./mobile-dialog";

vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
afterEach(cleanup);

describe("adaptive confirmation focus", () => {
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
