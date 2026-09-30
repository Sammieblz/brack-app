import { SettingsTaskProvider } from "@/contexts/SettingsTaskProvider";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { useSettingsLeave, useSettingsTask } from "./SettingsTaskContext";

vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const proceed = vi.fn();
function Editor({ dirty = true, pending = false }: { dirty?: boolean; pending?: boolean }) {
  useSettingsTask({ dirty, pending });
  const leave = useSettingsLeave();
  const navigate = useNavigate();
  return <><button onClick={() => void leave(proceed)}>Leave editor</button>
    <button onClick={() => navigate("/settings?section=reading")}>Browser navigation</button></>;
}
function Fixture(props: { dirty?: boolean; pending?: boolean }) {
  return <MemoryRouter><SettingsTaskProvider><Editor {...props} /></SettingsTaskProvider></MemoryRouter>;
}
describe("Settings task departure", () => {
  it("leaves a clean editor and consumes departure during a pending write", async () => {
    const view = render(<Fixture dirty={false} />);
    await act(async () => fireEvent.click(screen.getByText("Leave editor")));
    expect(proceed).toHaveBeenCalledOnce();
    proceed.mockClear();
    view.rerender(<Fixture pending />);
    await act(async () => fireEvent.click(screen.getByText("Leave editor")));
    expect(proceed).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("retains declined drafts and serializes a deferred confirmation", async () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Leave editor"));
    fireEvent.click(screen.getByText("Leave editor"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Keep editing" })));
    expect(proceed).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByText("Leave editor")));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Discard changes" })));
    expect(proceed).toHaveBeenCalledOnce();
  });
  it.each(["route", "unmount"])("invalidates a deferred acceptance after %s changes", async (change) => {
    const view = render(<Fixture />);
    fireEvent.click(screen.getByText("Leave editor"));
    if (change === "route") fireEvent.click(screen.getByText("Browser navigation"));
    else view.unmount();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(proceed).not.toHaveBeenCalled();
  });
});
