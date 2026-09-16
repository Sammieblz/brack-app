import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/components/settings/SupportContact", () => ({ SupportContact: () => <div>Shared support form</div> }));
vi.mock("@/components/ThemeAwareLogo", () => ({ ThemeAwareLogo: () => <span>Brack</span> }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">Change theme</button> }));

import SupportCenter from "./SupportCenter";

afterEach(() => { cleanup(); mocks.user = null; });

describe("SupportCenter", () => {
  it("is public and filters FAQs locally, including an empty state", () => {
    render(<MemoryRouter initialEntries={["/support"]}><SupportCenter /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "How can we help?" })).toBeInTheDocument();
    expect(screen.getByText("Shared support form")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    const search = screen.getByRole("searchbox", { name: "Search frequently asked questions" });
    fireEvent.change(search, { target: { value: "offline" } });
    expect(screen.getByText("Can I use Brack while offline?")).toBeInTheDocument();
    expect(screen.queryByText("How do I reset my password?")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "no matching help topic" } });
    expect(screen.getByText(/No answers match/)).toBeInTheDocument();
  });

  it("keeps legal and status placeholders honest and returns signed-in readers to Settings", () => {
    mocks.user = { id: "reader-76" };
    render(<MemoryRouter initialEntries={["/support"]}><SupportCenter /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByText(/not a current service-status report/)).toBeInTheDocument();
    expect(screen.getByText(/not a legal agreement/)).toBeInTheDocument();
    expect(screen.getByText(/full privacy policy has not been published/)).toBeInTheDocument();
  });
});
