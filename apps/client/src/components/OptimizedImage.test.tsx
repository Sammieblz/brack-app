import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OptimizedImage } from "./OptimizedImage";

afterEach(cleanup);

describe("OptimizedImage", () => {
  it("uses the inline error state instead of requesting a nonexistent default placeholder", async () => {
    render(<OptimizedImage alt="Missing cover" enableCache={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Image failed to load")).toBeInTheDocument();
    });
    expect(screen.queryByRole("img", { name: "Missing cover" })).not.toBeInTheDocument();
    expect(document.querySelector('[src="/placeholder.svg"]')).not.toBeInTheDocument();
  });

  it("preserves an explicit fallback when the primary image fails", () => {
    render(
      <OptimizedImage
        src="/covers/missing.webp"
        fallbackSrc="/covers/fallback.webp"
        alt="Book cover"
        enableCache={false}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Book cover" }));

    expect(screen.getByRole("img", { name: "Book cover" }))
      .toHaveAttribute("src", "/covers/fallback.webp");
    expect(screen.queryByLabelText("Image failed to load")).not.toBeInTheDocument();
  });

  it("stops rendering a broken image after both the primary and explicit fallback fail", () => {
    render(
      <OptimizedImage
        src="/covers/missing.webp"
        fallbackSrc="/covers/fallback.webp"
        alt="Book cover"
        enableCache={false}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Book cover" }));
    fireEvent.error(screen.getByRole("img", { name: "Book cover" }));

    expect(screen.queryByRole("img", { name: "Book cover" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Image failed to load")).toBeInTheDocument();
  });
});
