import { invokeFunction } from "./client";

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
export type SupportPlatform = "web" | "pwa" | "ios" | "android" | "desktop";

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
  const response = await invokeFunction<SupportResponse>("support-contact", {
    body: request,
  });
  if (!response?.accepted || response.request_id !== request.request_id) {
    throw new Error("The support service did not confirm this message");
  }
  return response;
};
