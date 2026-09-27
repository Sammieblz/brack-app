import { describe, expect, it, vi } from "vitest";

const invokeFunction = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ invokeFunction }));

import { submitSupportRequest, SupportSubmissionError, type SupportRequest } from "./support";

const request: SupportRequest = {
  request_id: "19feefcb-3d48-4f96-961d-3495c8dc8a61",
  category: "bug",
  subject: "Library will not open",
  message: "The library remains blank after reopening Brack.",
  include_diagnostics: false,
};

describe("support submission errors", () => {
  it("identifies a Turnstile rejection while keeping 403 from changing auth state", async () => {
    invokeFunction.mockRejectedValueOnce({
      context: new Response(JSON.stringify({ code: "turnstile_failed" }), { status: 403 }),
    });

    await expect(submitSupportRequest(request)).rejects.toMatchObject({
      code: "turnstile_failed",
    });
    expect(invokeFunction).toHaveBeenCalledWith("support-contact", { body: request }, {
      forbiddenRequiresAuth: false,
    });
  });

  it("preserves unrelated provider and gateway errors", async () => {
    const gatewayError = { context: new Response("Unavailable", { status: 502 }) };
    invokeFunction.mockRejectedValueOnce(gatewayError);
    await expect(submitSupportRequest(request)).rejects.toBe(gatewayError);
  });

  it("does not report success without the matching accepted request ID", async () => {
    invokeFunction.mockResolvedValueOnce({ accepted: true, request_id: "other" });
    await expect(submitSupportRequest(request)).rejects.toThrow("did not confirm");
    expect(SupportSubmissionError).toBeDefined();
  });
});
