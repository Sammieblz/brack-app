import { gsap } from 'gsap';
import { EASING } from './easing';

/**
 * GSAP animation presets for common animations
 * Optimized for mobile performance
 */

export const ANIMATION_DURATION = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8,
} as const;

/**
 * Fade in animation
 */
export const fadeIn = (element: gsap.TweenTarget, options?: {
  duration?: number;
  delay?: number;
  ease?: string;
}) => {
  return gsap.fromTo(
    element,
    { opacity: 0 },
    {
      opacity: 1,
      duration: options?.duration || ANIMATION_DURATION.normal,
      delay: options?.delay || 0,
      ease: options?.ease || EASING.smooth,
    }
  );
};

/**
 * Fade out animation
 */
export const fadeOut = (element: gsap.TweenTarget, options?: {
  duration?: number;
  delay?: number;
  ease?: string;
}) => {
  return gsap.to(element, {
    opacity: 0,
    duration: options?.duration || ANIMATION_DURATION.normal,
    delay: options?.delay || 0,
    ease: options?.ease || EASING.smooth,
  });
};

/**
 * Scale in animation (for modals, cards)
 */
export const scaleIn = (element: gsap.TweenTarget, options?: {
  duration?: number;
  delay?: number;
  ease?: string;
  from?: number;
}) => {
  return gsap.fromTo(
    element,
    { scale: options?.from || 0.8, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: options?.duration || ANIMATION_DURATION.normal,
      delay: options?.delay || 0,
      ease: options?.ease || EASING.backOut,
    }
  );
};

/**
 * Slide in from direction
 */
export const slideIn = (
  element: gsap.TweenTarget,
  direction: 'left' | 'right' | 'top' | 'bottom' = 'left',
  options?: {
    duration?: number;
    delay?: number;
    ease?: string;
    distance?: number;
  }
) => {
  const distance = options?.distance || 50;
  const from: Record<string, number> = { opacity: 0 };
  
  switch (direction) {
    case 'left':
      from.x = -distance;
      break;
    case 'right':
      from.x = distance;
      break;
    case 'top':
      from.y = -distance;
      break;
    case 'bottom':
      from.y = distance;
      break;
  }

  return gsap.fromTo(
    element,
    from,
    {
      x: 0,
      y: 0,
      opacity: 1,
      duration: options?.duration || ANIMATION_DURATION.normal,
      delay: options?.delay || 0,
      ease: options?.ease || EASING.smooth,
    }
  );
};

/**
 * Pulse animation (for loading, attention)
 */
export const pulse = (element: gsap.TweenTarget, options?: {
  duration?: number;
  repeat?: number;
  scale?: number;
}) => {
  return gsap.to(element, {
    scale: options?.scale || 1.1,
    duration: options?.duration || 0.6,
    repeat: options?.repeat || -1,
    yoyo: true,
    ease: EASING.smoothInOut,
  });
};

/**
 * Shake animation (for errors, attention)
 */
export const shake = (element: gsap.TweenTarget, options?: {
  duration?: number;
  intensity?: number;
}) => {
  const intensity = options?.intensity || 10;
  return gsap.to(element, {
    x: `+=${intensity}`,
    duration: 0.1,
    repeat: 5,
    yoyo: true,
    ease: EASING.linear,
    onComplete: () => {
      gsap.set(element, { x: 0 });
    },
  });
};

/**
 * Count up animation (for numbers, stats)
 */
export const countUp = (
  element: gsap.TweenTarget,
  from: number,
  to: number,
  options?: {
    duration?: number;
    ease?: string;
    onUpdate?: (value: number) => void;
  }
) => {
  const obj = { value: from };
  return gsap.to(obj, {
    value: to,
    duration: options?.duration || 1,
    ease: options?.ease || EASING.smooth,
    onUpdate: () => {
      if (element instanceof HTMLElement) {
        element.textContent = Math.round(obj.value).toString();
      }
      options?.onUpdate?.(obj.value);
    },
  });
};

/**
 * Stagger animation (for lists, grids)
 */
export const stagger = (
  elements: gsap.TweenTarget,
  animation: (element: gsap.TweenTarget) => gsap.core.Tween,
  options?: {
    delay?: number;
    stagger?: number;
  }
) => {
  return gsap.utils.toArray(elements).forEach((el, i) => {
    animation(el).delay((options?.delay || 0) + (i * (options?.stagger || 0.1)));
  });
};

/**
 * Glow pulse (for logos, important elements)
 */
export const glowPulse = (element: gsap.TweenTarget, options?: {
  duration?: number;
  intensity?: number;
}) => {
  return gsap.to(element, {
    filter: `drop-shadow(0 0 ${options?.intensity || 20}px rgba(var(--primary), 0.5))`,
    duration: options?.duration || 1.5,
    repeat: -1,
    yoyo: true,
    ease: EASING.smoothInOut,
  });
};
