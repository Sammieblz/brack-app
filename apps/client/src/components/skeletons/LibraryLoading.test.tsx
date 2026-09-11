import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LibraryViewSkeleton } from "./LibraryViewSkeleton";
import { BookListGridSkeleton } from "./BookListCardSkeleton";
import { BookListDetailSkeleton } from "./BookDetailSkeleton";
import { DashboardCardSkeleton } from "./DashboardCardSkeleton";
import { getShelfRowSize, LIBRARY_FLAT_GRID, LIBRARY_CAROUSEL_ITEM } from "@/components/library/libraryLayout";

describe("Library loading geometry and cardinality", () => {
  it.each(["flat", "bookshelf", "carousel"] as const)("does not invent books for a known empty %s view", (viewMode) => {
    const { container } = render(<LibraryViewSkeleton viewMode={viewMode} count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["flat", "bookshelf", "carousel"] as const)("respects a known count in %s mode", (viewMode) => {
    const selectors = { flat: '[data-skeleton="book-card"]', bookshelf: '[data-skeleton="shelf-book"]', carousel: '[data-skeleton="carousel-book"]' };
    const { container } = render(<LibraryViewSkeleton viewMode={viewMode} count={2} />);
    expect(container.querySelectorAll(selectors[viewMode])).toHaveLength(2);
    expect(container.querySelector("button, [tabindex]:not([tabindex='-1']), [role='status']")).toBeNull();
  });

  it.each([[320, 3], [390, 3], [768, 5], [834, 5], [1024, 7], [1440, 9]])("reserves one shelf row at %ipx", (width, count) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const { container } = render(<LibraryViewSkeleton viewMode="bookshelf" />);
    expect(getShelfRowSize(width)).toBe(count);
    expect(container.querySelectorAll('[data-skeleton="shelf-book"]')).toHaveLength(count);
    expect(container.querySelector(".library-shelf-books")).toHaveStyle({ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` });
  });

  it("shares flat and carousel breakpoints with the loaded views", () => {
    const { container, rerender } = render(<LibraryViewSkeleton viewMode="flat" />);
    expect(container.firstChild).toHaveAttribute("class", LIBRARY_FLAT_GRID);
    rerender(<LibraryViewSkeleton viewMode="carousel" />);
    const firstSlide = container.querySelector('[data-skeleton="carousel-book"]')?.parentElement;
    for (const className of LIBRARY_CAROUSEL_ITEM.split(" ")) expect(firstSlide).toHaveClass(className);
  });

  it("does not invent list cards for known empty collections", () => {
    const { container, rerender } = render(<BookListGridSkeleton count={0} />);
    expect(container.querySelector('[data-skeleton="book-list-card"]')).toBeNull();
    rerender(<BookListDetailSkeleton count={0} />);
    expect(container.querySelector('[data-skeleton="book-card"]')).toBeNull();
  });

  it("uses one primary continue card and the expected secondary count", () => {
    const { container, rerender } = render(<DashboardCardSkeleton secondaryCount={0} />);
    expect(container.querySelectorAll('[data-skeleton="continue-primary"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-skeleton="continue-secondary"]')).toHaveLength(0);
    rerender(<DashboardCardSkeleton secondaryCount={2} />);
    expect(container.querySelectorAll('[data-skeleton="continue-secondary"]')).toHaveLength(2);
  });
});
