import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "reader-76", email: "reader@example.com" } as { id: string; email: string } | null },
  connectivity: "online",
  runtime: "web",
  submit: vi.fn(),
  openEmail: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useNetworkStatus", () => ({
  useConnectivityState: () => mocks.connectivity,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/services/platform", () => ({
  getAuthFlowSurface: () => mocks.runtime,
  getRuntimePlatform: () => mocks.runtime,
  openSupportEmail: mocks.openEmail,
}));
vi.mock("@/services/api", () => ({
  SUPPORT_EMAIL: "support@brack-app.com",
  SUPPORT_SUBJECT_MAX_LENGTH: 120,
  SUPPORT_MESSAGE_MAX_LENGTH: 5_000,
  SUPPORT_CATEGORIES: [
    { value: "account", label: "Account & sign-in" },
    { value: "bug", label: "Something is not working" },
    { value: "billing", label: "Billing" },
    { value: "feedback", label: "Feedback or feature idea" },
    { value: "privacy", label: "Privacy & safety" },
    { value: "other", label: "Something else" },
  ],
  submitSupportRequest: mocks.submit,
}));

import { SupportContact } from "./SupportContact";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const fillForm = () => {
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "Library will not open" },
  });
  fireEvent.change(screen.getByLabelText("What happened?"), {
    target: { value: "The library remains blank after reopening Brack." },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = { id: "reader-76", email: "reader@example.com" };
  mocks.connectivity = "online";
  mocks.runtime = "web";
});

afterEach(cleanup);

describe("SupportContact", () => {
  it("waits for server acceptance, blocks duplicate clicks, and sends only safe diagnostics", async () => {
    const send = deferred<{ accepted: true; request_id: string }>();
    mocks.submit.mockReturnValue(send.promise);
    render(<SupportContact />);
    fillForm();

    const button = screen.getByRole("button", { name: "Send to support" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(screen.queryByText("Message accepted")).not.toBeInTheDocument();
    expect(screen.getByLabelText("What happened?")).toHaveValue(
      "The library remains blank after reopening Brack.",
    );
    const request = mocks.submit.mock.calls[0][0];
    expect(request).toEqual(expect.objectContaining({
      category: "bug",
      include_diagnostics: true,
      diagnostics: expect.objectContaining({ platform: "web" }),
    }));
    expect(request.diagnostics).not.toHaveProperty("logs");
    expect(request.diagnostics).not.toHaveProperty("location");

    await act(async () => send.resolve({
      accepted: true,
      request_id: request.request_id,
    }));

    expect(await screen.findByText("Message accepted")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("");
    expect(screen.getByLabelText("What happened?")).toHaveValue("");
  });

  it("preserves the draft and request ID for a recoverable retry", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("provider unavailable"));
    render(<SupportContact />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send to support" }));

    expect(await screen.findByText("Message not confirmed")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("Library will not open");
    const firstRequestId = mocks.submit.mock.calls[0][0].request_id;
    mocks.submit.mockResolvedValueOnce({ accepted: true, request_id: firstRequestId });
    fireEvent.click(screen.getByRole("button", { name: "Retry send" }));

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[1][0].request_id).toBe(firstRequestId);
  });

  it("does not queue private support content while offline", () => {
    mocks.connectivity = "offline";
    render(<SupportContact />);
    fillForm();

    expect(screen.getByRole("button", { name: "Send to support" })).toBeDisabled();
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByLabelText("What happened?")).toHaveValue(
      "The library remains blank after reopening Brack.",
    );
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("clears a private draft when the active account changes", async () => {
    const view = render(<SupportContact />);
    fillForm();
    mocks.auth.user = { id: "another-reader", email: "another@example.com" };
    view.rerender(<SupportContact />);

    await waitFor(() => expect(screen.getByLabelText("Subject")).toHaveValue(""));
    expect(screen.getByLabelText("What happened?")).toHaveValue("");
  });

  it("keeps the in-app form available when a desktop mail composer cannot open", async () => {
    mocks.runtime = "desktop";
    mocks.openEmail.mockResolvedValue(false);
    render(<SupportContact />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Email support" }));

    expect(await screen.findByText("Message not confirmed")).toBeInTheDocument();
    expect(screen.getByText(/No email app was available/)).toBeInTheDocument();
    expect(screen.getByLabelText("What happened?")).toHaveValue(
      "The library remains blank after reopening Brack.",
    );
  });
});
