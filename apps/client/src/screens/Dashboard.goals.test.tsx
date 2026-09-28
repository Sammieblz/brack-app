import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { requestOverlayBack } from "@/lib/backLayers";

const layout = vi.hoisted(() => ({ mobile: true }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => layout.mobile }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader" }, loading: false }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useGoals", () => ({ useGoals: () => ({
  goals: [], activeGoals: [], loading: false, refreshing: false, hasLoaded: true, error: null,
  refetch: vi.fn(), createGoal: vi.fn(), deleteGoal: vi.fn(), completeGoal: vi.fn(),
}) }));
vi.mock("@/hooks/useDashboardHomeData", () => ({ useDashboardHomeData: () => ({
  dashboardHome: null, journey: null, primaryBook: null, secondaryBooks: [], loading: false,
  fetching: false, error: null, refetch: vi.fn(),
}) }));
vi.mock("@/hooks/useOnboardingStatus", () => ({ useOnboardingStatus: () => ({ status: { onboarding_status: "completed" } }) }));
vi.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ gamificationEnabled: false }) }));
vi.mock("@/hooks/useConfirmedRewardFeedback", () => ({ useConfirmedRewardFeedback: vi.fn() }));
vi.mock("@/hooks/useStreakCelebration", () => ({ useStreakCelebration: () => ({ isOpen: false, streak: 0, dismiss: vi.fn() }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfileContext: () => ({ profile: null }) }));
vi.mock("@/contexts/TimerContext", () => ({ useTimer: () => ({ startTimer: vi.fn() }) }));
vi.mock("@/services/api", () => ({ applyReadingStreakFreeze: vi.fn() }));
vi.mock("@/services/telemetry", () => ({ trackCoreEvent: vi.fn() }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/PullToRefresh", () => ({ PullToRefresh: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/NativeScrollView", () => ({ NativeScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
// These remain two different component types, reproducing the real responsive
// parent switch while keeping unrelated header/navigation state outside scope.
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: ({ action }: { action: ReactNode }) => <header data-testid="mobile-header">{action}</header> }));
vi.mock("@/components/NativeHeader", () => ({ NativeHeader: ({ action }: { action: ReactNode }) => <header data-testid="wide-header">{action}</header> }));
vi.mock("@/components/ProgressLogger", () => ({ ProgressLogger: () => null }));
vi.mock("@/components/StreakCelebrationOverlay", () => ({ StreakCelebrationOverlay: () => null }));

import Dashboard from "./Dashboard";

afterEach(() => { cleanup(); layout.mobile = true; });

it("keeps the actual Goals create draft outside Dashboard's replaced responsive header", async () => {
  const { rerender } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
  const firstTrigger = screen.getByRole("button", { name: "Goals" });
  fireEvent.click(firstTrigger);
  fireEvent.click(screen.getByRole("button", { name: "Create Goal" }));
  const dialog = screen.getByRole("dialog", { name: "Create New Goal" });
  const target = screen.getByRole("spinbutton", { name: "Target" });
  fireEvent.change(target, { target: { value: "52" } });
  target.focus();
  layout.mobile = false;
  rerender(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(firstTrigger.isConnected).toBe(false);
  expect(screen.getByTestId("wide-header")).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Create New Goal" })).toBe(dialog);
  expect(target).toHaveValue(52);
  expect(target).toHaveFocus();
  act(() => { expect(requestOverlayBack()).toBe(true); });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create New Goal" })).not.toBeInTheDocument());
  act(() => { expect(requestOverlayBack()).toBe(true); });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("button", { name: "Goals" })).toHaveFocus());
});
