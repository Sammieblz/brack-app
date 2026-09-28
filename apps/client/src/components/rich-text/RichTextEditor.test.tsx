import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toPlainRichTextPayload } from "@/lib/richText";
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor";

afterEach(cleanup);

// jsdom has no layout hit-testing/range geometry. These tests assert DOM
// semantics and focus; the browser fixture owns actual layout and typing.
beforeAll(() => {
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => null });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
});
afterAll(() => {
  Reflect.deleteProperty(document, "elementFromPoint");
  Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
  Reflect.deleteProperty(Range.prototype, "getClientRects");
});

describe("rich text editor accessibility boundary", () => {
  it("puts labels, descriptions, required state and changing errors on the editable textbox", async () => {
    const onChange = vi.fn();
    const ref = createRef<RichTextEditorHandle>();
    const content = toPlainRichTextPayload("Keep this writing");
    const form = (invalid: boolean) => <TooltipProvider>
      <label id="review-label" htmlFor="review-editor">Review</label>
      <p id="review-help">Minimum 10 characters</p>
      {invalid && <p id="review-error">Review is too short</p>}
      <RichTextEditor id="review-editor" ref={ref} aria-labelledby="review-label"
        aria-describedby={`review-help${invalid ? " review-error" : ""}`} aria-invalid={invalid}
        aria-required="true" value={content} onChange={onChange} />
    </TooltipProvider>;
    const view = render(form(false));
    const textbox = await screen.findByRole("textbox", { name: "Review" });
    expect(textbox).toHaveAttribute("contenteditable", "true");
    expect(textbox).toHaveAttribute("aria-required", "true");
    expect(textbox).toHaveAccessibleDescription(/Minimum 10 characters/);
    view.rerender(form(true));
    expect(textbox).toHaveAttribute("aria-invalid", "true");
    expect(textbox).toHaveAccessibleDescription(/Review is too short/);
    view.rerender(form(false));
    expect(textbox).toHaveAttribute("aria-invalid", "false");
    expect(textbox).not.toHaveAccessibleDescription(/Review is too short/);
    expect(textbox).toHaveTextContent("Keep this writing");
    expect(onChange).not.toHaveBeenCalled();
    // The form controller's ref can focus the editor without a wrapper div.
    act(() => { ref.current?.focus(); });
    await waitFor(() => expect(textbox).toHaveFocus());
  });

  it("retains content without update events when disabled and gives each editor unique count descriptions", async () => {
    const onChange = vi.fn();
    const value = toPlainRichTextPayload("Existing text");
    const form = (disabled: boolean) => <TooltipProvider>
      <RichTextEditor aria-label="First note" value={value} disabled={disabled} onChange={onChange} />
      <RichTextEditor aria-label="Second note" value={value} onChange={onChange} />
    </TooltipProvider>;
    const view = render(form(false));
    const first = await screen.findByRole("textbox", { name: "First note" });
    const second = screen.getByRole("textbox", { name: "Second note" });
    expect(first.id).not.toBe(second.id);
    expect(first.getAttribute("aria-describedby")).not.toBe(second.getAttribute("aria-describedby"));
    view.rerender(form(true));
    expect(first).toHaveAttribute("contenteditable", "false");
    expect(first).toHaveAttribute("aria-disabled", "true");
    expect(first).toHaveTextContent("Existing text");
    view.rerender(form(false));
    expect(first).toHaveAttribute("contenteditable", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names the link URL field and exposes formatting toggle state", async () => {
    render(<TooltipProvider><RichTextEditor aria-label="Note" onChange={vi.fn()} /></TooltipProvider>);
    await screen.findByRole("textbox", { name: "Note" });
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(await screen.findByRole("textbox", { name: "Link URL" })).toHaveValue("https://");
  });

  it("removes stale ARIA names when an editor changes its labeling source", async () => {
    const form = (useLabel: boolean) => <TooltipProvider>
      {useLabel && <span id="old-label">Old label</span>}
      <RichTextEditor aria-labelledby={useLabel ? "old-label" : undefined}
        aria-label={useLabel ? undefined : "Current label"} onChange={vi.fn()} />
    </TooltipProvider>;
    const view = render(form(true));
    const textbox = await screen.findByRole("textbox", { name: "Old label" });
    view.rerender(form(false));
    expect(screen.getByRole("textbox", { name: "Current label" })).toBe(textbox);
    expect(textbox).toHaveAttribute("aria-labelledby", "");
    view.rerender(form(true));
    expect(screen.getByRole("textbox", { name: "Old label" })).toBe(textbox);
    expect(textbox).toHaveAttribute("aria-label", "");
  });
});
