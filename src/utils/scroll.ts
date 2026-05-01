export type ScrollTarget = HTMLElement | Window;

const SCROLLABLE_OVERFLOW_VALUES = new Set(["auto", "scroll", "overlay"]);

export const getScrollParent = (
  element: HTMLElement | null,
  options: { includeSelf?: boolean } = {}
): ScrollTarget => {
  if (!element) return window;

  let parent = options.includeSelf ? element : element.parentElement;

  while (parent && parent !== document.body) {
    if (parent.dataset.appScrollContainer === "true") {
      return parent;
    }

    const style = window.getComputedStyle(parent);
    const canScrollY = SCROLLABLE_OVERFLOW_VALUES.has(style.overflowY);

    if (canScrollY && (parent !== element || parent.scrollHeight > parent.clientHeight)) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return window;
};

export const getScrollTop = (target: ScrollTarget) => {
  if (target === window) {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  return target.scrollTop;
};

export const addScrollListener = (
  target: ScrollTarget,
  listener: EventListener,
  options?: AddEventListenerOptions
) => {
  target.addEventListener("scroll", listener, options);

  return () => {
    target.removeEventListener("scroll", listener, options);
  };
};
