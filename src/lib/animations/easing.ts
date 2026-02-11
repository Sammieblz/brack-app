/**
 * Easing functions for animations
 * Optimized for mobile performance and natural feel
 */

export const EASING = {
  // Standard easings
  linear: 'linear',
  easeIn: 'power1.in',
  easeOut: 'power1.out',
  easeInOut: 'power1.inOut',
  
  // Smooth, natural easings (Duolingo-style)
  smooth: 'power2.out',
  smoothIn: 'power2.in',
  smoothInOut: 'power2.inOut',
  
  // Bouncy, playful easings
  bounce: 'bounce.out',
  elastic: 'elastic.out(1, 0.3)',
  
  // Back easings (slight overshoot)
  backOut: 'back.out(1.7)',
  backInOut: 'back.inOut(1.7)',
  
  // Custom cubic bezier for mobile feel
  mobile: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  mobileBounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

export type EasingType = typeof EASING[keyof typeof EASING];
