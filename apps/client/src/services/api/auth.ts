import type {
  AuthChangeEvent,
  AuthError,
  OAuthResponse,
  Provider,
  Session,
  Subscription,
  User,
} from "@supabase/supabase-js";
import {
  AuthApiError,
  isAuthError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isCustomSchemeAuthRuntime, openExternalUrl } from "@/services/platform";
import { getApiErrorStatus, invokeFunction } from "./client";

export interface EmailSignUpRequest {
  email: string;
  password: string;
  redirectTo?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailPasswordSignInRequest {
  email: string;
  password: string;
}

export interface OAuthSignInRequest {
  provider: Provider;
  redirectTo?: string;
}

export type EmailSignUpOutcome =
  | { kind: "signed_in"; session: Session }
  | { kind: "email_exists"; email: string }
  | { kind: "confirmation_pending"; email: string };

export interface SignUpEmailResendRequest {
  email: string;
  redirectTo?: string;
}

export type AuthStateChangeHandler = (
  event: AuthChangeEvent,
  session: Session | null
) => void | Promise<void>;

const throwIfAuthError = (error: AuthError | null) => {
  if (error) throw error;
};

const EXISTENCE_SENSITIVE_SIGNUP_CODES = new Set([
  "user_already_exists",
  "email_exists",
]);

interface EmailAvailabilityResponse {
  exists: boolean;
}

const EMAIL_AVAILABILITY_FUNCTION = "auth-email-availability";

// Remove accidental form whitespace while leaving provider-level email
// canonicalization to Supabase Auth.
const normalizeAuthEmail = (email: string) => email.trim();

export const getAuthSession = async (): Promise<Session | null> => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  throwIfAuthError(error);
  return session;
};

export const getCurrentAuthUser = async (): Promise<User | null> => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  throwIfAuthError(error);
  return user;
};

/**
 * Resolve the verified user when authentication is optional.
 *
 * A missing session is a normal signed-out state. Every other Auth error is
 * kept observable so connectivity and invalid-session failures are not
 * accidentally presented as a clean sign-out.
 */
export const getOptionalCurrentAuthUser = async (): Promise<User | null> => {
  let session: Session | null;
  try {
    session = await getAuthSession();
  } catch (error) {
    if (isAuthSessionMissingError(error)) return null;
    throw error;
  }
  if (!session) return null;

  try {
    return await getCurrentAuthUser();
  } catch (error) {
    if (isAuthSessionMissingError(error)) return null;
    throw error;
  }
};

export const onAuthStateChange = (
  handler: AuthStateChangeHandler
): Subscription => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(handler);

  return subscription;
};

export const signUpWithEmail = async ({
  email,
  password,
  redirectTo,
  metadata,
}: EmailSignUpRequest): Promise<EmailSignUpOutcome> => {
  const normalizedEmail = normalizeAuthEmail(email);

  let availability: EmailAvailabilityResponse;
  try {
    availability = await invokeFunction<EmailAvailabilityResponse>(
      EMAIL_AVAILABILITY_FUNCTION,
      { body: { email: normalizedEmail } },
    );
  } catch (error) {
    const status = getApiErrorStatus(error);
    if (status === 429) throw error;

    throw new AuthApiError(
      status === 400
        ? "The email address could not be validated."
        : "Email availability could not be verified.",
      status === 400 ? 400 : 503,
      status === 400
        ? "email_address_invalid"
        : "email_availability_unavailable",
    );
  }

  if (!availability || typeof availability.exists !== "boolean") {
    throw new AuthApiError(
      "Email availability returned an invalid response.",
      503,
      "email_availability_unavailable",
    );
  }

  if (availability.exists) {
    return { kind: "email_exists", email: normalizedEmail };
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: metadata,
    },
  });

  if (
    error &&
    isAuthError(error) &&
    error.code &&
    EXISTENCE_SENSITIVE_SIGNUP_CODES.has(error.code)
  ) {
    return { kind: "email_exists", email: normalizedEmail };
  }

  throwIfAuthError(error);

  if (data.session) {
    return { kind: "signed_in", session: data.session };
  }

  if (!data.user) {
    throw new AuthProtocolError(
      "Signup completed without a session or user response.",
    );
  }

  // With email confirmation enabled, Supabase can represent an existing user
  // as an obfuscated user with no identities. Brack intentionally turns that
  // signal into a visible duplicate-email error per the product requirement.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { kind: "email_exists", email: normalizedEmail };
  }

  return { kind: "confirmation_pending", email: normalizedEmail };
};

export const resendSignUpEmail = async ({
  email,
  redirectTo,
}: SignUpEmailResendRequest): Promise<void> => {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizeAuthEmail(email),
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  throwIfAuthError(error);
};

export const signInWithEmailPassword = async ({
  email,
  password,
}: EmailPasswordSignInRequest) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeAuthEmail(email),
    password,
  });

  throwIfAuthError(error);
  void data;
};

export const signInWithOAuth = async ({
  provider,
  redirectTo,
}: OAuthSignInRequest): Promise<OAuthResponse["data"]> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: isCustomSchemeAuthRuntime(),
    },
  });

  throwIfAuthError(error);

  if (isCustomSchemeAuthRuntime() && data.url) {
    await openExternalUrl(data.url);
  }

  return data;
};

export const handleAuthCallbackUrl = async (callbackUrl: string) => {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch (error) {
    throw new AuthCallbackError(
      "This sign-in link is invalid. Request a fresh link and try again.",
      "malformed_url",
      error,
    );
  }
  const searchParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const error = searchParams.get("error") ?? hashParams.get("error");
  const errorDescription =
    searchParams.get("error_description") ?? hashParams.get("error_description");

  if (error) {
    throw new AuthCallbackError(
      "The sign-in request was not completed. Start again to continue.",
      "provider_rejected",
      errorDescription || error,
    );
  }

  const code = searchParams.get("code") ?? hashParams.get("code");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new AuthCallbackError(
        "This sign-in link is invalid, expired, or already used.",
        "exchange_failed",
        error,
      );
    }
    return data;
  }

  const accessToken = searchParams.get("access_token") ?? hashParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token") ?? hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      throw new AuthCallbackError(
        "This sign-in link is invalid, expired, or already used.",
        "exchange_failed",
        error,
      );
    }
    return data;
  }

  throw new AuthCallbackError(
    "This sign-in link is invalid or has expired. Request a fresh link and try again.",
    "missing_credentials",
  );
};

export class AuthCallbackError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | "provider_rejected"
      | "missing_credentials"
      | "malformed_url"
      | "exchange_failed",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AuthCallbackError";
  }
}

export class AuthProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthProtocolError";
  }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  throwIfAuthError(error);
};

export const sendPasswordResetEmail = async (
  email: string,
  redirectTo?: string
) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizeAuthEmail(email), {
    redirectTo,
  });

  throwIfAuthError(error);
  return data;
};

export const updatePassword = async (password: string) => {
  const { data, error } = await supabase.auth.updateUser({ password });
  throwIfAuthError(error);
  return data;
};
