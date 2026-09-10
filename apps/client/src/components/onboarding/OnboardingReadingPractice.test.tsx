import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingReadingPractice } from "./OnboardingReadingPractice";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const getPageInput = () => screen.getByRole("spinbutton", { name: "Page you reached" });
const getProgress = () => screen.getByRole("progressbar", { name: "Sample book reading progress" });

describe("OnboardingReadingPractice", () => {
  it("labels the optional sample and starts with an accurate bookmark", () => {
    render(<OnboardingReadingPractice />);

    expect(screen.getByText("Optional practice")).toBeInTheDocument();
    expect(screen.getByText(/Nothing here is added to your library or streak/)).toBeInTheDocument();
    expect(screen.getByText("Sample book · 200 illustrative pages")).toBeInTheDocument();
    expect(getProgress()).toHaveAttribute("aria-valuenow", "32");
    expect(getProgress()).toHaveAttribute("aria-valuemax", "200");
    expect(getProgress()).toHaveAttribute("aria-valuetext", "Page 32 of 200");
    expect(getPageInput()).toHaveValue(44);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("records the pages immediately, then resets the isolated practice", async () => {
    const user = userEvent.setup();
    render(<OnboardingReadingPractice />);

    await user.click(screen.getByRole("button", { name: "Log practice pages" }));

    expect(getProgress()).toHaveAttribute("aria-valuenow", "44");
    expect(screen.getByRole("status")).toHaveTextContent("12 pages read.");
    expect(screen.getByRole("status")).toHaveTextContent("You can pick up at page 44 next time.");
    expect(getPageInput()).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Log practice pages" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Reset practice" }));

    expect(getProgress()).toHaveAttribute("aria-valuenow", "32");
    expect(getPageInput()).not.toHaveAttribute("readonly");
    expect(getPageInput()).toHaveFocus();
    expect(getPageInput()).toHaveValue(44);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Log practice pages" })).toBeEnabled();
  });

  it.each([
    ["", "Enter a whole page number"],
    ["43.5", "Enter a whole page number"],
    ["0", "Choose a page after 32"],
    ["-1", "Choose a page after 32"],
    ["31", "Choose a page after 32"],
    ["32", "Choose a page after 32"],
    ["201", "This sample ends at page 200"],
  ])("rejects %j without changing progress and preserves the input", async (value, message) => {
    const user = userEvent.setup();
    render(<OnboardingReadingPractice />);

    fireEvent.change(getPageInput(), { target: { value } });
    await user.click(screen.getByRole("button", { name: "Log practice pages" }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(getPageInput()).toHaveAttribute("aria-invalid", "true");
    expect(getPageInput()).toHaveValue(value === "" ? null : Number(value));
    expect(getPageInput()).toHaveFocus();
    expect(getProgress()).toHaveAttribute("aria-valuenow", "32");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("clears an error when corrected and supports a one-page update", async () => {
    const user = userEvent.setup();
    render(<OnboardingReadingPractice />);

    fireEvent.change(getPageInput(), { target: { value: "32" } });
    await user.click(screen.getByRole("button", { name: "Log practice pages" }));
    fireEvent.change(getPageInput(), { target: { value: "33" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log practice pages" }));

    expect(screen.getByRole("status")).toHaveTextContent("1 page read.");
    expect(getProgress()).toHaveAttribute("aria-valuenow", "33");
  });

  it("explains completion at the upper boundary without claiming real rewards", async () => {
    const user = userEvent.setup();
    render(<OnboardingReadingPractice />);

    fireEvent.change(getPageInput(), { target: { value: "200" } });
    await user.click(screen.getByRole("button", { name: "Log practice pages" }));

    expect(getProgress()).toHaveAttribute("aria-valuenow", "200");
    expect(screen.getByRole("status")).toHaveTextContent("168 pages read.");
    expect(screen.getByRole("status")).toHaveTextContent("You reached the end of the sample book.");
  });

  it("allows keyboard completion with immediate progress instead of decorative motion", async () => {
    const user = userEvent.setup();
    const { container } = render(<OnboardingReadingPractice />);

    await user.tab();
    expect(getPageInput()).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(getProgress()).toHaveAttribute("aria-valuenow", "44");
    expect(container.querySelector(".onboarding-reading-practice")).toHaveAttribute("data-pointer-motion", "false");
    expect(screen.getByRole("status")).toHaveTextContent("12 pages read.");
  });

  it("never persists or requests data, and resets when the component is remounted", async () => {
    const user = userEvent.setup();
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { unmount } = render(<OnboardingReadingPractice />);

    await user.click(screen.getByRole("button", { name: "Log practice pages" }));
    unmount();
    render(<OnboardingReadingPractice />);

    expect(getProgress()).toHaveAttribute("aria-valuenow", "32");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(storageWrite).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
