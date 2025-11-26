import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Book } from "@/types";

export const useVirtualBooks = (books: Book[], estimateSize = 148) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: books.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 6,
  });

  return { parentRef, virtualizer };
};
