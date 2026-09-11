import { useLayoutEffect, useRef } from "react";

/** Publish the complete sticky header height (including its HUD/tab rail) to
 * the owning app scroller. Measurement changes with layout, never with scroll. */
export const useAppHeader = () => {
  const headerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const owner = header?.closest<HTMLElement>('[data-app-scroll-container="true"]');
    if (!header || !owner) return;

    const previousHeight = owner.style.getPropertyValue("--app-header-height");
    let lastHeight = -1;
    const publishHeight = (height: number) => {
      if (height === lastHeight) return;
      lastHeight = height;
      owner.style.setProperty("--app-header-height", `${height}px`);
    };

    publishHeight(header.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      publishHeight(entry.borderBoxSize?.[0]?.blockSize ?? header.getBoundingClientRect().height);
    });
    observer.observe(header, { box: "border-box" });

    return () => {
      observer.disconnect();
      if (previousHeight) owner.style.setProperty("--app-header-height", previousHeight);
      else owner.style.removeProperty("--app-header-height");
    };
  }, []);

  return headerRef;
};
