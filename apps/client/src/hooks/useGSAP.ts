import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { EasingType } from '@/lib/animations/easing';

interface UseGSAPOptions {
  dependencies?: unknown[];
  immediate?: boolean;
}

/**
 * Hook for GSAP animations with automatic cleanup
 * Accepts either options object or dependencies array for convenience
 */
export const useGSAP = (
  callback: () => void | gsap.core.Tween | gsap.core.Timeline,
  optionsOrDeps: UseGSAPOptions | unknown[] = {}
) => {
  // Handle both formats: { dependencies: [...] } or [...]
  const options: UseGSAPOptions = Array.isArray(optionsOrDeps)
    ? { dependencies: optionsOrDeps }
    : optionsOrDeps;
  
  const { dependencies = [], immediate = true } = options;
  const ctxRef = useRef<gsap.Context | null>(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!immediate && hasRunRef.current) return;
    
    // Create context - callback uses gsap directly, context handles cleanup
    const ctx = gsap.context(() => {
      callback();
    });
    
    ctxRef.current = ctx;
    hasRunRef.current = true;

    return () => {
      if (ctxRef.current) {
        ctxRef.current.revert();
        ctxRef.current = null;
      }
    };
  }, dependencies);

  return ctxRef.current;
};

/**
 * Hook for GSAP timeline with automatic cleanup
 */
export const useGSAPTimeline = (
  callback: (tl: gsap.core.Timeline) => void,
  options: UseGSAPOptions = {}
) => {
  const { dependencies = [], immediate = true } = options;
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!immediate && timelineRef.current) return;

    const tl = gsap.timeline();
    callback(tl);
    timelineRef.current = tl;

    return () => {
      tl.kill();
      timelineRef.current = null;
    };
  }, dependencies);

  return timelineRef.current;
};

/**
 * Hook for animating on mount/unmount
 */
export const useGSAPAnimation = (
  animation: (element: HTMLElement) => gsap.core.Tween,
  deps: unknown[] = []
) => {
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (elementRef.current) {
      const tween = animation(elementRef.current);
      return () => {
        tween.kill();
      };
    }
  }, deps);

  return elementRef;
};
