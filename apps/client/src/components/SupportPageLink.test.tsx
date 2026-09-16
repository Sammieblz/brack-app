import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const platformMocks = vi.hoisted(() => ({
  isDesktopRuntime: vi.fn(() => false),
  isMobileNativeRuntime: vi.fn(() => false),
  openSupportPage: vi.fn(),
}));

vi.mock("@/services/platform", () => platformMocks);

import { SupportPageLink } from "./SupportPageLink";

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.hash}</output>;
};

const renderLink = () => render(
  <MemoryRouter initialEntries={["/settings"]}>
    <SupportPageLink section="faqs">FAQs</SupportPageLink>
    <Routes>
      <Route path="*" element={<Location />} />
    </Routes>
  </MemoryRouter>,
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  platformMocks.isDesktopRuntime.mockReturnValue(false);
  platformMocks.isMobileNativeRuntime.mockReturnValue(false);
});

describe("SupportPageLink", () => {
  it("navigates within web and PWA", () => {
    renderLink();
    fireEvent.click(screen.getByRole("link", { name: "FAQs" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/support#faqs");
    expect(platformMocks.openSupportPage).not.toHaveBeenCalled();
  });

  it("opens installed-app support in a browser without navigating the app", async () => {
    platformMocks.isMobileNativeRuntime.mockReturnValue(true);
    platformMocks.openSupportPage.mockResolvedValue(true);
    renderLink();
    fireEvent.click(screen.getByRole("link", { name: "FAQs" }));
    await waitFor(() => expect(platformMocks.openSupportPage).toHaveBeenCalledWith("faqs"));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings");
  });

  it("does not open multiple browser windows on rapid repeat clicks", async () => {
    platformMocks.isMobileNativeRuntime.mockReturnValue(true);
    let finishOpening: (opened: boolean) => void = () => {};
    platformMocks.openSupportPage.mockReturnValue(new Promise<boolean>((resolve) => { finishOpening = resolve; }));
    renderLink();
    const link = screen.getByRole("link", { name: "FAQs" });
    fireEvent.click(link);
    fireEvent.click(link);
    expect(platformMocks.openSupportPage).toHaveBeenCalledTimes(1);
    finishOpening(true);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings"));
  });

  it("opens the local support page if the installed-app browser fails", async () => {
    platformMocks.isDesktopRuntime.mockReturnValue(true);
    platformMocks.openSupportPage.mockResolvedValue(false);
    renderLink();
    fireEvent.click(screen.getByRole("link", { name: "FAQs" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/support#faqs"));
  });
});
