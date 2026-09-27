import { invokeFunction } from "./client";

type SupportFailureCode = "turnstile_failed" | "origin_not_allowed";

export class SupportSubmissionError extends Error {
  constructor(public readonly code: SupportFailureCode) {
    super(code);
    this.name = "SupportSubmissionError";
  }
}

const getSupportFailureCode = async (error: unknown): Promise<SupportFailureCode | null> => {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const response = error.context;
  if (!(response instanceof Response) || response.status !== 403) return null;

  try {
    const body: unknown = await response.clone().json();
    if (!body || typeof body !== "object") return null;
    if ("code" in body && body.code === "turnstile_failed") return "turnstile_failed";
    if ("error" in body && body.error === "Origin not allowed") return "origin_not_allowed";
  } catch {
    // A gateway response may not be JSON; preserve its original error.
  }
  return null;
};

export const SUPPORT_EMAIL = "support@brack-app.com";
export const SUPPORT_SUBJECT_MAX_LENGTH = 120;
export const SUPPORT_MESSAGE_MAX_LENGTH = 5_000;

export const SUPPORT_CATEGORIES = [
  { value: "account", label: "Account & sign-in" },
  { value: "bug", label: "Something is not working" },
  { value: "billing", label: "Billing" },
  { value: "feedback", label: "Feedback or feature idea" },
  { value: "privacy", label: "Privacy & safety" },
  { value: "other", label: "Something else" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];
export type SupportPlatform = "web" | "mobile" | "desktop";

export type SupportRequest = {
  request_id: string;
  category: SupportCategory;
  subject: string;
  message: string;
  reply_email?: string;
  include_diagnostics: boolean;
  diagnostics?: {
    app_version: string;
    platform: SupportPlatform;
  };
  turnstile_token?: string;
};

export type SupportResponse = {
  accepted: true;
  request_id: string;
  duplicate?: boolean;
};

export const submitSupportRequest = async (request: SupportRequest) => {
  let response: SupportResponse;
  try {
    response = await invokeFunction<SupportResponse>("support-contact", {
      body: request,
    }, { forbiddenRequiresAuth: false });
  } catch (error) {
    const code = await getSupportFailureCode(error);
    if (code) throw new SupportSubmissionError(code);
    throw error;
  }
  if (!response?.accepted || response.request_id !== request.request_id) {
    throw new Error("The support service did not confirm this message");
  }
  return response;
};
