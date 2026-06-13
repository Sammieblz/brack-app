import { useState, useCallback } from "react";
import { useHapticFeedback } from "./useHapticFeedback";

interface UseTapFeedbackOptions {
  hapticType?: "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";
  scale?: number;
  disabled?: boolean;
}

export const useTapFeedback = (options: UseTapFeedbackOptions = {}) => {
  const { hapticType = "light", scale = 0.95, disabled = false } = options;
  const { triggerHaptic } = useHapticFeedback();
  const [isPressed, setIsPressed] = useState(false);

  const handlePressStart = useCallback(() => {
    if (disabled) return;
    setIsPressed(true);
    triggerHaptic(hapticType);
  }, [disabled, hapticType, triggerHaptic]);

  const handlePressEnd = useCallback(() => {
    if (disabled) return;
    setIsPressed(false);
  }, [disabled]);

  const pressProps = {
    onMouseDown: handlePressStart,
    onMouseUp: handlePressEnd,
    onMouseLeave: handlePressEnd,
    onTouchStart: handlePressStart,
    onTouchEnd: handlePressEnd,
    onTouchCancel: handlePressEnd,
    style: {
      transform: isPressed ? `scale(${scale})` : "scale(1)",
      transition: "transform 0.1s ease-out",
    },
    className: isPressed ? "opacity-80" : "",
  };

  return {
    isPressed,
    pressProps,
    handlePressStart,
    handlePressEnd,
  };
};
