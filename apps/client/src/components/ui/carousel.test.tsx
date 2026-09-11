import { fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Carousel } from "./carousel";

const api = vi.hoisted(() => ({
  scrollPrev: vi.fn(), scrollNext: vi.fn(), canScrollPrev: () => true,
  canScrollNext: () => true, on: vi.fn(), off: vi.fn(),
}));
vi.mock("embla-carousel-react", () => ({ default: () => [() => {}, api] }));

describe("Carousel keyboard ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps arrow navigation on slide buttons", () => {
    render(<Carousel><button>Open book</button></Carousel>);
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowLeft" });
    expect(api.scrollNext).toHaveBeenCalledTimes(1);
    expect(api.scrollPrev).toHaveBeenCalledTimes(1);
  });

  it("does not hijack text, composite controls, or portalled dialog arrows", () => {
    render(<Carousel>
      <input aria-label="Find a list" />
      <span role="slider" tabIndex={0} aria-label="Progress" />
      <span contentEditable suppressContentEditableWarning>Draft</span>
      {createPortal(<div role="dialog"><button>Keep book</button></div>, document.body)}
    </Carousel>);
    for (const target of [screen.getByRole("textbox"), screen.getByRole("slider"), screen.getByText("Draft"), screen.getByRole("button")]) {
      expect(fireEvent.keyDown(target, { key: "ArrowRight" })).toBe(true);
      expect(fireEvent.keyDown(target, { key: "ArrowLeft" })).toBe(true);
    }
    expect(api.scrollNext).not.toHaveBeenCalled();
    expect(api.scrollPrev).not.toHaveBeenCalled();
  });
});
