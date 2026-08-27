import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Book, Clock, Palette } from "iconoir-react";

import {
  OnboardingChapterIndicator,
  type OnboardingChapter,
} from "./OnboardingChapterIndicator";

const chapters: readonly OnboardingChapter[] = [
  { id: "welcome", label: "Welcome", eyebrow: "Personalization", icon: Book },
  { id: "palette", label: "Palette", eyebrow: "App color", icon: Palette },
  { id: "taste", label: "Taste", eyebrow: "Reading taste", icon: Book },
  { id: "pace", label: "Pace", eyebrow: "Reading pace", icon: Clock },
  { id: "goal", label: "Goal", eyebrow: "Goal setup", icon: Book },
  { id: "review", label: "Review", eyebrow: "Ready to save", icon: Book },
];

afterEach(cleanup);

describe("OnboardingChapterIndicator", () => {
  it("announces exact chapter progress and exposes all chapters by name", () => {
    render(
      <OnboardingChapterIndicator
        chapters={chapters}
        currentStep="pace"
        onStepSelect={vi.fn()}
      />,
    );

    const progress = screen.getByRole("progressbar", { name: "Onboarding setup progress" });
    expect(progress).toHaveAttribute("aria-valuemin", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "6");
    expect(progress).toHaveAttribute("aria-valuenow", "4");
    expect(progress).toHaveAttribute("aria-valuetext", "Chapter 4 of 6: Pace");
    expect(screen.getByText("Chapter 4 of 6")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("distinguishes completed, current, and upcoming chapters without color alone", () => {
    const { container } = render(
      <OnboardingChapterIndicator
        chapters={chapters}
        currentStep="taste"
        onStepSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Welcome, chapter 1 of 6, completed" }))
      .toHaveClass("onboarding-chapters__button--complete");
    expect(screen.getByRole("button", { name: "Taste, chapter 3 of 6" }))
      .toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Review, chapter 6 of 6" }))
      .not.toHaveAttribute("aria-current");
    expect(container.querySelector<HTMLElement>(".onboarding-chapters__rail")?.style
      .getPropertyValue("--onboarding-chapter-progress")).toBe("40%");
  });

  it("supports direct chapter selection and disables every target while saving", async () => {
    const onStepSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <OnboardingChapterIndicator
        chapters={chapters}
        currentStep="welcome"
        onStepSelect={onStepSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Goal, chapter 5 of 6" }));
    expect(onStepSelect).toHaveBeenCalledWith("goal");

    rerender(
      <OnboardingChapterIndicator
        chapters={chapters}
        currentStep="welcome"
        disabled
        onStepSelect={onStepSelect}
      />,
    );
    expect(screen.getAllByRole("button")).toEqual(
      expect.arrayContaining(chapters.map(() => expect.objectContaining({ disabled: true }))),
    );
  });
});
