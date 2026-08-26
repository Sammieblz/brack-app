import type { CSSProperties, ElementType } from "react";
import { Check } from "iconoir-react";

import type { OnboardingStepId } from "@/services/onboarding";
import { cn } from "@/lib/utils";

export interface OnboardingChapter {
  id: OnboardingStepId;
  label: string;
  eyebrow: string;
  icon: ElementType;
}

interface OnboardingChapterIndicatorProps {
  chapters: readonly OnboardingChapter[];
  currentStep: OnboardingStepId;
  disabled?: boolean;
  onStepSelect: (step: OnboardingStepId) => void;
}

type ChapterRailStyle = CSSProperties & {
  "--onboarding-chapter-progress": string;
};

export const OnboardingChapterIndicator = ({
  chapters,
  currentStep,
  disabled = false,
  onStepSelect,
}: OnboardingChapterIndicatorProps) => {
  const currentIndex = Math.max(0, chapters.findIndex((chapter) => chapter.id === currentStep));
  const currentChapter = chapters[currentIndex] ?? chapters[0];
  const chapterCount = chapters.length;
  const railProgress = chapterCount > 1 ? (currentIndex / (chapterCount - 1)) * 100 : 100;

  if (!currentChapter || chapterCount === 0) return null;

  const CurrentIcon = currentChapter.icon;
  const valueText = `Chapter ${currentIndex + 1} of ${chapterCount}: ${currentChapter.label}`;

  return (
    <nav className="onboarding-chapters" aria-label="Onboarding chapters">
      <div className="onboarding-chapters__summary">
        <span className="onboarding-chapters__current-icon" aria-hidden="true">
          <CurrentIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="onboarding-chapters__count">
            Chapter {currentIndex + 1} of {chapterCount}
          </span>
          <span className="onboarding-chapters__current-label">{currentChapter.label}</span>
          <span className="onboarding-chapters__current-detail">{currentChapter.eyebrow}</span>
        </span>
      </div>

      <span
        className="sr-only"
        role="progressbar"
        aria-label="Onboarding setup progress"
        aria-valuemin={1}
        aria-valuemax={chapterCount}
        aria-valuenow={currentIndex + 1}
        aria-valuetext={valueText}
      />
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {valueText}
      </span>

      <div
        className="onboarding-chapters__rail"
        style={{ "--onboarding-chapter-progress": `${railProgress}%` } as ChapterRailStyle}
      >
        <span className="onboarding-chapters__track" aria-hidden="true">
          <span className="onboarding-chapters__track-fill" />
        </span>

        <ol className="onboarding-chapters__list">
          {chapters.map((chapter, index) => {
            const ChapterIcon = chapter.icon;
            const isCurrent = index === currentIndex;
            const isComplete = index < currentIndex;

            return (
              <li key={chapter.id} className="min-w-0">
                <button
                  type="button"
                  className={cn(
                    "onboarding-chapters__button",
                    isCurrent && "onboarding-chapters__button--current",
                    isComplete && "onboarding-chapters__button--complete",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${chapter.label}, chapter ${index + 1} of ${chapterCount}${isComplete ? ", completed" : ""}`}
                  disabled={disabled}
                  onClick={() => onStepSelect(chapter.id)}
                >
                  <span className="onboarding-chapters__node" aria-hidden="true">
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : isCurrent ? (
                      <ChapterIcon className="h-4 w-4" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </span>
                  <span className="onboarding-chapters__label">{chapter.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
};
