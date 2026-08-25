import { describe, expect, it } from "vitest";
import { AuthApiError } from "@supabase/supabase-js";
import { presentAuthFailure } from "./authFailure";

describe("presentAuthFailure", () => {
  it("states that a rate-limited email attempt sent no link", () => {
    const result = presentAuthFailure(
      new AuthApiError(
        "429: email rate limit exceeded",
        429,
        "over_email_send_rate_limit",
      ),
      "sign_up",
    );

    expect(result).toEqual({
      title: "Email limit reached",
      description:
        "No link was sent for this attempt. Check your inbox for an earlier Brack email, then try again later.",
      rateLimited: true,
    });
    expect(result.description).not.toMatch(/minute|60 seconds/i);
  });

  it("does not promise a fixed wait or automatically retry a general Auth 429", () => {
    const result = presentAuthFailure(
      new AuthApiError("Too many requests", 429, "over_request_rate_limit"),
      "oauth",
    );

    expect(result.rateLimited).toBe(true);
    expect(result.description).toContain("will not retry");
    expect(result.description).not.toMatch(/minute|60 seconds/i);
  });

  it("maps a rate-limited availability request without requiring an AuthError", () => {
    const result = presentAuthFailure({ status: 429 }, "sign_up");

    expect(result).toEqual({
      title: "Too many attempts",
      description:
        "This request was not completed. Please wait before trying again. Brack will not retry it automatically.",
      rateLimited: true,
    });
  });

  it("explains that a failed availability check did not create an account", () => {
    const result = presentAuthFailure(
      new AuthApiError(
        "Internal availability detail",
        503,
        "email_availability_unavailable",
      ),
      "sign_up",
    );

    expect(result).toEqual({
      title: "Email check unavailable",
      description:
        "Brack could not verify whether this email is available. No account was created. Please try again.",
      rateLimited: false,
    });
  });

  it("maps invalid credentials without exposing the backend message", () => {
    const result = presentAuthFailure(
      new AuthApiError(
        "Invalid login credentials for a sensitive backend reason",
        400,
        "invalid_credentials",
      ),
      "sign_in",
    );

    expect(result).toEqual({
      title: "Sign-in details not recognized",
      description:
        "Check your email and password, or use Reset password if you no longer remember it.",
      rateLimited: false,
    });
    expect(result.description).not.toContain("sensitive backend reason");
  });

  it.each([
    [
      "weak_password",
      "Choose a stronger password",
      "Use a password that meets the listed requirements, then try again.",
    ],
    [
      "email_address_invalid",
      "Check your email address",
      "Enter a valid email address, then try again.",
    ],
    [
      "validation_failed",
      "Check your details",
      "Review the information you entered, then try again.",
    ],
    [
      "captcha_failed",
      "Verification failed",
      "Complete the security check again, then retry your request.",
    ],
    [
      "email_provider_disabled",
      "Email sign-in unavailable",
      "Email and password authentication is currently unavailable. Try another sign-in method or come back later.",
    ],
    [
      "provider_disabled",
      "Sign-in method unavailable",
      "That sign-in method is currently unavailable. Try another method or come back later.",
    ],
    [
      "email_not_confirmed",
      "Email confirmation needed",
      "Confirm your email before signing in. You can request a newer confirmation link if needed.",
      true,
    ],
    [
      "signup_disabled",
      "Sign-up unavailable",
      "New email sign-ups are currently unavailable. Please come back later.",
    ],
    [
      "email_address_not_authorized",
      "Email not authorized",
      "This email address cannot receive authentication messages from this Brack environment.",
    ],
    [
      "user_banned",
      "Sign-in unavailable",
      "This account cannot sign in right now. Contact Brack support if you believe this is a mistake.",
    ],
  ])("maps actionable Auth code %s", (code, title, description, confirmationRequired) => {
    expect(
      presentAuthFailure(
        new AuthApiError("Raw provider message", 400, code),
        "sign_up",
      ),
    ).toEqual({
      title,
      description,
      rateLimited: false,
      ...(confirmationRequired ? { confirmationRequired: true } : {}),
    });
  });

  it.each(["user_already_exists", "email_exists"])(
    "maps %s to the requested duplicate-email error",
    (code) => {
      const result = presentAuthFailure(
        new AuthApiError("User already registered", 422, code),
        "sign_up",
      );

      expect(result).toEqual({
        title: "Email already exists",
        description:
          "This email is already used by another reader. Sign in instead, or continue with Google if you originally joined with Google.",
        rateLimited: false,
      });
      expect(JSON.stringify(result)).not.toContain("User already registered");
    },
  );

  it.each([
    ["sign_up", "Sign-up failed"],
    ["sign_in", "Sign-in failed"],
    ["password_reset", "Password reset failed"],
    ["resend", "Email not sent"],
    ["oauth", "Sign-in failed"],
  ] as const)(
    "never renders an unknown raw backend message for %s",
    (operation, title) => {
      const result = presentAuthFailure(
        new AuthApiError(
          "Internal database detail that must stay private",
          500,
          "unexpected_failure",
        ),
        operation,
      );

      expect(result.title).toBe(title);
      expect(result.description).not.toContain("Internal database detail");
      expect(result.rateLimited).toBe(false);
    },
  );

  it("uses safe fallback copy for a non-Auth exception", () => {
    const result = presentAuthFailure(
      new Error("Raw network implementation detail"),
      "resend",
    );

    expect(result).toEqual({
      title: "Email not sent",
      description:
        "Brack could not confirm the email request. Check your inbox before trying again.",
      rateLimited: false,
    });
  });
});
