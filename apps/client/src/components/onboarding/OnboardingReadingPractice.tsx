import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

import "./onboarding-reading-practice.css";

const START_PAGE = 32;
const SAMPLE_PAGES = 200;
const SUGGESTED_PAGE = 44;

/** An isolated demonstration, deliberately disconnected from books, drafts, and rewards. */
export function OnboardingReadingPractice() {
  const id = useId();
  const pageInputRef = useRef<HTMLInputElement>(null);
  const pointerActionRef = useRef(false);
  const [pageInput, setPageInput] = useState(String(SUGGESTED_PAGE));
  const [recordedPage, setRecordedPage] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [animateProgress, setAnimateProgress] = useState(false);
  const currentPage = recordedPage ?? START_PAGE;

  const logPracticePages = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPage = Number(pageInput);
    let nextError = "";

    if (!pageInput.trim() || !Number.isInteger(nextPage)) {
      nextError = "Enter a whole page number, such as 44.";
    } else if (nextPage <= START_PAGE) {
      nextError = `Choose a page after ${START_PAGE} to try recording some reading.`;
    } else if (nextPage > SAMPLE_PAGES) {
      nextError = `This sample ends at page ${SAMPLE_PAGES}. Choose a page up to ${SAMPLE_PAGES}.`;
    }

    if (nextError) {
      setError(nextError);
      pageInputRef.current?.focus();
      return;
    }

    setError("");
    setAnimateProgress(pointerActionRef.current);
    setRecordedPage(nextPage);
  };

  const resetPractice = () => {
    setPageInput(String(SUGGESTED_PAGE));
    setRecordedPage(null);
    setError("");
    setAnimateProgress(pointerActionRef.current);
    pageInputRef.current?.focus();
  };

  return (
    <section
      className="onboarding-reading-practice"
      aria-labelledby={`${id}-title`}
      data-pointer-motion={animateProgress ? "true" : "false"}
      onPointerDown={() => { pointerActionRef.current = true; }}
      onKeyDown={() => { pointerActionRef.current = false; }}
    >
      <p className="onboarding-reading-practice__eyebrow">Optional practice</p>
      <h2 id={`${id}-title`} className="onboarding-reading-practice__title">
        A few pages. A place to return to.
      </h2>
      <p className="onboarding-reading-practice__description">
        Try a reading update. Nothing here is added to your library or streak.
      </p>

      <div className="onboarding-reading-practice__book">
        <h3 className="onboarding-reading-practice__book-title">The Secret Garden</h3>
        <p className="onboarding-reading-practice__metadata">Frances Hodgson Burnett</p>
        <p className="onboarding-reading-practice__metadata">Sample book · 200 illustrative pages</p>
        <div className="onboarding-reading-practice__position">
          <span>Page {currentPage} of {SAMPLE_PAGES}</span>
          <span>{Math.round((currentPage / SAMPLE_PAGES) * 100)}%</span>
        </div>
        <Progress
          value={currentPage}
          max={SAMPLE_PAGES}
          aria-label="Sample book reading progress"
          getValueLabel={(value, max) => `Page ${value} of ${max}`}
        />
      </div>

      <form onSubmit={logPracticePages} noValidate className="onboarding-reading-practice__form">
        <div>
          <label htmlFor={`${id}-page`} className="onboarding-reading-practice__label">
            Page you reached
          </label>
          <Input
            ref={pageInputRef}
            id={`${id}-page`}
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            min={START_PAGE + 1}
            max={SAMPLE_PAGES}
            step={1}
            value={pageInput}
            onChange={(event) => {
              setPageInput(event.target.value);
              setError("");
            }}
            readOnly={recordedPage !== null}
            aria-label="Page you reached"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            className="onboarding-reading-practice__input"
          />
          <p id={`${id}-hint`} className="onboarding-reading-practice__hint">
            Your sample bookmark starts at page {START_PAGE}.
          </p>
          {error && <p id={`${id}-error`} role="alert" className="onboarding-reading-practice__error">{error}</p>}
        </div>

        <div className="onboarding-reading-practice__actions">
          <Button
            type="submit"
            variant="outline"
            disableHaptic
            disabled={recordedPage !== null}
            className="onboarding-reading-practice__button"
          >
            Log practice pages
          </Button>
          <Button
            type="button"
            variant="ghost"
            disableHaptic
            onClick={resetPractice}
            className="onboarding-reading-practice__button"
          >
            Reset practice
          </Button>
        </div>
      </form>

      <div role="status" aria-atomic="true" className="onboarding-reading-practice__result">
        {recordedPage !== null && (
          <>
            <p className="onboarding-reading-practice__result-title">
              {recordedPage - START_PAGE} {recordedPage - START_PAGE === 1 ? "page" : "pages"} read.
            </p>
            <p>
              {recordedPage === SAMPLE_PAGES
                ? "You reached the end of the sample book."
                : `You can pick up at page ${recordedPage} next time.`}
              {" "}That is the reading loop: read, record, return.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
