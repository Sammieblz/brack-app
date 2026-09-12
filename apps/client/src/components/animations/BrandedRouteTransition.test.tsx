import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BrandedRouteTransition } from "./BrandedRouteTransition";

describe("BrandedRouteTransition", () => {
  it("navigates as soon as the destination is known without displaying a timed loader", () => {
    render(
      <MemoryRouter initialEntries={["/from"]}>
        <Routes>
          <Route
            path="/from"
            element={(
              <BrandedRouteTransition
                to="/destination"
                message="Opening your dashboard..."
              />
            )}
          />
          <Route path="/destination" element={<p>Destination ready</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Destination ready")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
