import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

import "./landing-typewriter.css";

// Deliberately kept in memory: a new document may type again, while returning
// through the client router must show the finished headline immediately.
let hasEnteredLanding = false;

interface LandingTypewriterProps {
  text: string;
  className?: string;
}

/** A brief first-entry flourish. Render inside the page's semantic heading. */
export const LandingTypewriter = ({ text, className }: LandingTypewriterProps) => {
  const reducedMotion = useReducedMotion();
  const initialText = useRef(text);
  const [typeOnEntry] = useState(() => !hasEnteredLanding && !reducedMotion);
  const [finished, setFinished] = useState(!typeOnEntry);
  const characters = Array.from(text);
  const stepDuration = Math.min(60, 2000 / Math.max(characters.length, 1));
  const totalDuration = 70 + characters.length * stepDuration + 100;
  const typing = typeOnEntry && !finished && !reducedMotion && text === initialText.current;

  useEffect(() => {
    hasEnteredLanding = true;

    if (finished) return;

    // Changing a preference (or the supplied copy) completes the introduction;
    // restoring that preference should never start it over.
    if (!typeOnEntry || reducedMotion || text !== initialText.current) {
      setFinished(true);
      return;
    }

    const completion = window.setTimeout(() => setFinished(true), totalDuration);
    return () => window.clearTimeout(completion);
  }, [finished, reducedMotion, text, totalDuration, typeOnEntry]);

  let characterIndex = 0;

  return (
    <span className={cn("landing-typewriter", className)} data-typing={typing ? "true" : "false"}>
      <span className="sr-only">{text}</span>
      <span className="landing-typewriter__text" aria-hidden="true">
        {text.split(/(\s+)/u).map((part, partIndex) => {
          if (/^\s+$/u.test(part)) {
            characterIndex += Array.from(part).length;
            return <Fragment key={partIndex}>{part}</Fragment>;
          }

          return (
            <span className="landing-typewriter__word" key={partIndex}>
              {Array.from(part).map((character, index) => {
                const delay = 70 + characterIndex * stepDuration;
                const isLast = characterIndex === characters.length - 1;
                characterIndex += 1;

                return (
                  <span
                    className="landing-typewriter__character"
                    key={index}
                    style={
                      {
                        "--type-delay": `${delay}ms`,
                        "--caret-duration": `${isLast ? stepDuration + 100 : stepDuration}ms`,
                      } as CSSProperties
                    }
                  >
                    {character}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </span>
  );
};
