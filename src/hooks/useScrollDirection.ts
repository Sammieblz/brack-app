import { useState, useEffect } from "react";

export type ScrollDirection = "up" | "down" | "top";

export const useScrollDirection = (threshold = 10) => {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>("top");
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;

      if (scrollY < threshold) {
        setScrollDirection("top");
      } else if (Math.abs(scrollY - lastScrollY) < threshold) {
        ticking = false;
        return;
      } else {
        const direction = scrollY > lastScrollY ? "down" : "up";
        setScrollDirection(direction);
      }

      setLastScrollY(scrollY);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, [lastScrollY, threshold]);

  return scrollDirection;
};
