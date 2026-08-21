import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  useStreakCelebration,
  type UseStreakCelebrationOptions,
} from "@/hooks/useStreakCelebration";

const baseline: UseStreakCelebrationOptions = {
  userId: "reader-1",
  ready: true,
  completedToday: false,
  currentStreak: 6,
  completionKey: "2026-08-15",
};

describe("useStreakCelebration", () => {
  it("does not replay a completed streak from the first loaded snapshot", () => {
    const { result } = renderHook(() => useStreakCelebration({
      ...baseline,
      completedToday: true,
      currentStreak: 7,
      completionKey: "2026-08-16",
    }));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.celebrationKey).toBeNull();
  });

  it("opens only after a confirmed incomplete-to-complete transition", () => {
    const { result, rerender } = renderHook(
      (props: UseStreakCelebrationOptions) => useStreakCelebration(props),
      { initialProps: baseline },
    );

    rerender({
      ...baseline,
      completedToday: true,
      currentStreak: 7,
      completionKey: "2026-08-16",
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.streak).toBe(7);
    expect(result.current.celebrationKey).toBe("2026-08-16");

    act(() => result.current.dismiss());
    expect(result.current.isOpen).toBe(false);
  });

  it("arms from the first authoritative snapshot after loading without celebrating it", () => {
    const { result, rerender } = renderHook(
      (props: UseStreakCelebrationOptions) => useStreakCelebration(props),
      {
        initialProps: {
          ...baseline,
          ready: false,
          completedToday: true,
          currentStreak: 7,
          completionKey: "2026-08-16",
        },
      },
    );

    rerender({
      ...baseline,
      ready: true,
      completedToday: true,
      currentStreak: 7,
      completionKey: "2026-08-16",
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("does not replay the same completion identity after dismissal", () => {
    const { result, rerender } = renderHook(
      (props: UseStreakCelebrationOptions) => useStreakCelebration(props),
      { initialProps: baseline },
    );
    const completed = {
      ...baseline,
      completedToday: true,
      currentStreak: 7,
      completionKey: "2026-08-16",
    };

    rerender(completed);
    act(() => result.current.dismiss());
    rerender({ ...completed, completedToday: false });
    rerender(completed);

    expect(result.current.isOpen).toBe(false);
  });

  it("resets and treats another reader's state as a new baseline", () => {
    const { result, rerender } = renderHook(
      (props: UseStreakCelebrationOptions) => useStreakCelebration(props),
      { initialProps: baseline },
    );

    rerender({
      ...baseline,
      completedToday: true,
      completionKey: "2026-08-16",
    });
    expect(result.current.isOpen).toBe(true);

    rerender({
      ...baseline,
      userId: "reader-2",
      completedToday: true,
      completionKey: "2026-08-16",
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.celebrationKey).toBeNull();
  });

  it("disarms while unloaded and treats the next confirmed state as a baseline", () => {
    const { result, rerender } = renderHook(
      (props: UseStreakCelebrationOptions) => useStreakCelebration(props),
      { initialProps: baseline },
    );

    rerender({
      ...baseline,
      completedToday: true,
      currentStreak: 7,
      completionKey: "2026-08-16",
    });
    expect(result.current.isOpen).toBe(true);

    rerender({ ...baseline, ready: false, completedToday: true });
    expect(result.current.isOpen).toBe(false);

    rerender({
      ...baseline,
      ready: true,
      completedToday: true,
      currentStreak: 7,
      completionKey: "2026-08-16",
    });
    expect(result.current.isOpen).toBe(false);
  });
});
