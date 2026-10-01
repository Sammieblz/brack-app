import { useLayoutEffect, useRef, useState } from "react";
import { getShelfRowSize } from "./libraryLayout";

/** Observe the actual pane and a rem-sized probe, including live text resizing. */
export function useShelfColumns(active = true) {
  const shelfRef = useRef<HTMLElement | null>(null);
  const [columns, setColumns] = useState(2);
  useLayoutEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    const measure = () => {
      if (shelf.clientWidth) setColumns(getShelfRowSize(shelf.clientWidth, parseFloat(getComputedStyle(shelf).fontSize) || 16));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shelf);
    const probe = shelf.querySelector("[data-shelf-measure]");
    if (probe) observer.observe(probe);
    return () => observer.disconnect();
  }, [active]);
  return { shelfRef, columns };
}
