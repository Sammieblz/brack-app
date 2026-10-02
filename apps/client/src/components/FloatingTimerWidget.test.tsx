import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  timer: {
    time: 123, isVisible: true, isRunning: true, clientSessionId: "session-1", bookTitle: "A reader's long book title",
    startTimer: vi.fn(), pauseTimer: vi.fn(), resumeTimer: vi.fn(),
    finishTimer: vi.fn<() => Promise<void>>(), cancelTimer: vi.fn(),
  },
}));
vi.mock("@/contexts/TimerContext", () => ({ useTimer: () => mocks.timer }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader" } }) }));
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({
  books: [{ id: "book-1", title: "Currently reading", status: "reading" }],
  loading: false, refreshing: false, hasLoaded: true, error: null, refetchBooks: vi.fn(),
}) }));

import { FloatingTimerWidget } from "./FloatingTimerWidget";
import { HeaderTimerWidget } from "./HeaderTimerWidget";
import { ReadingSessionTasksProvider } from "./reading-session/ReadingSessionTasks";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.timer, { time: 123, isVisible: true, isRunning: true, clientSessionId: "session-1" });
  mocks.timer.finishTimer.mockResolvedValue(undefined);
});
const openDetails = () => fireEvent.click(screen.getByRole("button", { name: "Open timer details" }));

describe("shell reading session controls", () => {
  it("keeps one active control owner and delegates pause/resume to the timer", () => {
    const view = render(<MemoryRouter><ReadingSessionTasksProvider><HeaderTimerWidget /><FloatingTimerWidget /></ReadingSessionTasksProvider></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Start reading timer" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));
    expect(mocks.timer.pauseTimer).toHaveBeenCalledTimes(1);
    mocks.timer.isRunning = false;
    view.rerender(<MemoryRouter><ReadingSessionTasksProvider><HeaderTimerWidget /><FloatingTimerWidget /></ReadingSessionTasksProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Resume timer" }));
    expect(mocks.timer.resumeTimer).toHaveBeenCalledTimes(1);
  });

  it("keeps the idle reading picker available and starts the selected book", () => {
    mocks.timer.isVisible = false;
    render(<MemoryRouter><ReadingSessionTasksProvider><HeaderTimerWidget /><FloatingTimerWidget /></ReadingSessionTasksProvider></MemoryRouter>);
    expect(screen.queryByRole("region", { name: "Active reading session" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start reading timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Currently reading" }));
    expect(mocks.timer.startTimer).toHaveBeenCalledWith("book-1", "Currently reading");
  });

  it("waits for finish, refuses dismissal/duplicate actions and retains a provider-handled failure for retry", async () => {
    let complete!: () => void;
    mocks.timer.finishTimer.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    render(<FloatingTimerWidget />);
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));
    const finish = screen.getByRole("button", { name: "Save session" });
    fireEvent.click(finish);
    fireEvent.click(finish);
    expect(mocks.timer.finishTimer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel session" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => { complete(); });
    // The provider catches persistence errors; a resolved call alone must not
    // remove the unsaved session or its retry control.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save session" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save session" }));
    await waitFor(() => expect(mocks.timer.finishTimer).toHaveBeenCalledTimes(2));
  });

  it("keeps an unexpectedly rejected save recoverable", async () => {
    mocks.timer.finishTimer.mockRejectedValueOnce(new Error("Offline failure"));
    render(<FloatingTimerWidget />);
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));
    fireEvent.click(screen.getByRole("button", { name: "Save session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your timer is still available");
    expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
    expect(mocks.timer.cancelTimer).not.toHaveBeenCalled();
  });

  it("leaves cancellation confirmation to the provider and restores details-trigger focus on close", async () => {
    render(<FloatingTimerWidget />);
    const trigger = screen.getByRole("button", { name: "Open timer details" });
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Cancel session" }));
    expect(mocks.timer.cancelTimer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("resets the details surface after the provider clears a completed session", () => {
    const view = render(<FloatingTimerWidget />);
    openDetails();
    mocks.timer.isVisible = false;
    view.rerender(<FloatingTimerWidget />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    mocks.timer.isVisible = true;
    view.rerender(<FloatingTimerWidget />);
    expect(screen.getByRole("region", { name: "Active reading session" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not offer a zero-duration finish", () => {
    mocks.timer.time = 0;
    render(<FloatingTimerWidget />);
    openDetails();
    expect(screen.getByRole("button", { name: "Finish session" })).toBeDisabled();
  });

  it("does not reopen an idle picker after a session started elsewhere has finished", () => {
    mocks.timer.isVisible = false;
    const view = render(<MemoryRouter><ReadingSessionTasksProvider><HeaderTimerWidget /></ReadingSessionTasksProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Start reading timer" }));
    expect(screen.getByRole("button", { name: "Currently reading" })).toBeInTheDocument();
    mocks.timer.isVisible = true;
    mocks.timer.clientSessionId = "session-2";
    view.rerender(<MemoryRouter><ReadingSessionTasksProvider><HeaderTimerWidget /></ReadingSessionTasksProvider></MemoryRouter>);
    mocks.timer.isVisible = false;
    view.rerender(<MemoryRouter><ReadingSessionTasksProvider><HeaderTimerWidget /></ReadingSessionTasksProvider></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Start reading timer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Currently reading" })).not.toBeInTheDocument();
  });
});
