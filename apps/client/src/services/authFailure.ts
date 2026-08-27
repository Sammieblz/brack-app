import { isAuthError } from "@supabase/supabase-js";
import { getApiErrorStatus } from "@/services/api/client";

export type AuthFailureOperation =
  | "sign_up"
  | "sign_in"
  | "password_reset"
  | "resend"
  | "oauth";

export interface AuthFailurePresentation {
  title: string;
  description: string;
  rateLimited: boolean;
  confirmationRequired?: boolean;
}

const operationTitle = (operation: AuthFailureOperation) => {
  switch (operation) {
    case "sign_up":
      return "Sign-up failed";
    case "sign_in":
    case "oauth":
      return "Sign-in failed";
    case "password_reset":
      return "Password reset failed";
    case "resend":
      return "Email not sent";
  }
};

const operationDescription = (operation: AuthFailureOperation) => {
  switch (operation) {
    case "sign_up":
      return "Brack could not confirm the sign-up result. Check your inbox before trying again.";
    case "sign_in":
      return "Brack could not sign you in. Check your details and try again.";
    case "password_reset":
      return "Brack could not confirm the password reset request. Check your inbox before trying again.";
    case "resend":
      return "Brack could not confirm the email request. Check your inbox before trying again.";
    case "oauth":
      return "Brack could not start provider sign-in. Please try again.";
  }
};

const CODE_PRESENTATIONS: Record<
  string,
  Omit<AuthFailurePresentation, "rateLimited">
> = {
  invalid_credentials: {
    title: "Sign-in details not recognized",
    description:
      "Check your email and password, or use Reset password if you no longer remember it.",
  },
  email_not_confirmed: {
    title: "Email confirmation needed",
    description:
      "Confirm your email before signing in. You can request a newer confirmation link if needed.",
    confirmationRequired: true,
  },
  weak_password: {
    title: "Choose a stronger password",
    description:
      "Use a password that meets the listed requirements, then try again.",
  },
  email_address_invalid: {
    title: "Check your email address",
    description: "Enter a valid email address, then try again.",
  },
  validation_failed: {
    title: "Check your details",
    description: "Review the information you entered, then try again.",
  },
  captcha_failed: {
    title: "Verification failed",
    description: "Complete the security check again, then retry your request.",
  },
  otp_expired: {
    title: "Code not accepted",
    description:
      "This code is incorrect, expired, or from an older email. Enter the six-digit code from the newest Brack message.",
  },
  otp_disabled: {
    title: "Email code unavailable",
    description:
      "Brack cannot verify email codes right now. Use the secure email link or try again later.",
  },
  email_provider_disabled: {
    title: "Email sign-in unavailable",
    description:
      "Email and password authentication is currently unavailable. Try another sign-in method or come back later.",
  },
  provider_disabled: {
    title: "Sign-in method unavailable",
    description:
      "That sign-in method is currently unavailable. Try another method or come back later.",
  },
  signup_disabled: {
    title: "Sign-up unavailable",
    description:
      "New email sign-ups are currently unavailable. Please come back later.",
  },
  email_address_not_authorized: {
    title: "Email not authorized",
    description:
      "This email address cannot receive authentication messages from this Brack environment.",
  },
  user_banned: {
    title: "Sign-in unavailable",
    description:
      "This account cannot sign in right now. Contact Brack support if you believe this is a mistake.",
  },
  user_already_exists: {
    title: "Email already exists",
    description:
      "This email is already used by another reader. Sign in instead, or continue with Google if you originally joined with Google.",
  },
  email_exists: {
    title: "Email already exists",
    description:
      "This email is already used by another reader. Sign in instead, or continue with Google if you originally joined with Google.",
  },
  email_availability_unavailable: {
    title: "Email check unavailable",
    description:
      "Brack could not verify whether this email is available. No account was created. Please try again.",
  },
};

export const presentAuthFailure = (
  error: unknown,
  operation: AuthFailureOperation,
): AuthFailurePresentation => {
  if (isAuthError(error)) {
    if (error.code === "over_email_send_rate_limit") {
      return {
        title: "Email limit reached",
        description:
          "No link was sent for this attempt. Check your inbox for an earlier Brack email, then try again later.",
        rateLimited: true,
      };
    }

    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return {
        title: "Too many attempts",
        description:
          "This request was not completed. Please wait before trying again. Brack will not retry it automatically.",
        rateLimited: true,
      };
    }

    if (error.code) {
      const presentation = CODE_PRESENTATIONS[error.code];
      if (presentation) {
        return { ...presentation, rateLimited: false };
      }
    }
  }

  if (getApiErrorStatus(error) === 429) {
    return {
      title: "Too many attempts",
      description:
        "This request was not completed. Please wait before trying again. Brack will not retry it automatically.",
      rateLimited: true,
    };
  }

  return {
    title: operationTitle(operation),
    description: operationDescription(operation),
    rateLimited: false,
  };
};
