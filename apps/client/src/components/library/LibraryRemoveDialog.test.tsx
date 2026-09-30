import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryRemoveDialog } from "./LibraryRemoveDialog";

vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
afterEach(cleanup);
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe("owned Library removal", () => {
  it("keeps the pending task open, blocks duplicate intent and retains a rejected removal for retry", async () => {
    const request = deferred();
    const remove = vi.fn().mockReturnValueOnce(request.promise).mockResolvedValue(undefined);
    function Task() {
      const [open, setOpen] = useState(true);
      return <LibraryRemoveDialog open={open} onOpenChange={setOpen} title="Delete this book?"
        description="The book will leave your library." onConfirm={remove} />;
    }
    render(<Task />);
    expect(screen.getByRole("button", { name: "Keep book" })).toHaveFocus();
    const submit = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(submit); fireEvent.click(submit);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(remove).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Keep book" })).toBeDisabled();
    await act(async () => request.reject(new Error("Couldn't save the removal.")));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save the removal.");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("an obsolete completion cannot close a replacement opening", async () => {
    const request = deferred();
    const close = vi.fn();
    const remove = vi.fn().mockReturnValue(request.promise);
    const task = (open: boolean) => <LibraryRemoveDialog open={open} onOpenChange={close}
      title="Delete this book?" description="Remove from library." onConfirm={remove} />;
    const view = render(task(true));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    view.rerender(task(false));
    view.rerender(task(true));
    await act(async () => request.resolve());
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("unmount withdraws the removal outcome", async () => {
    const request = deferred();
    const close = vi.fn();
    const view = render(<LibraryRemoveDialog open onOpenChange={close} title="Remove from list?"
      description="The book remains in the library." onConfirm={() => request.promise} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    view.unmount();
    await act(async () => request.resolve());
    expect(close).not.toHaveBeenCalled();
  });
});
