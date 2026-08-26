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

export interface EmailSignUpRequest {
  email: string;
  password: string;
  redirectTo?: string;
  metadata?: Record<string, unknown>;
  captchaToken?: string;
}

export interface EmailPasswordSignInRequest {
  email: string;
  password: string;
  captchaToken?: string;
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
  captchaToken?: string;
}

export interface VerifyEmailOtpRequest {
  email: string;
  token: string;
  type: "signup" | "recovery";
}

export interface VerifiedEmailOtpData {
  session: Session;
  user: User;
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

const VERIFIED_USER_CACHE_TTL_MS = 5 * 60_000;

type VerifiedUserCacheEntry = {
  accessToken: string;
  expiresAt: number;
  user: User;
};

type VerifiedUserRequest = {
  accessToken: string;
  generation: number;
  promise: Promise<User | null>;
};

let verifiedUserCache: VerifiedUserCacheEntry | null = null;
let verifiedUserRequest: VerifiedUserRequest | null = null;
let verifiedUserCacheGeneration = 0;

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

export const clearVerifiedAuthUserCache = () => {
  verifiedUserCacheGeneration += 1;
  verifiedUserCache = null;
  verifiedUserRequest = null;
};

/**
 * Seed the short-lived verified-user cache from a successful Auth response.
 * The session itself came from Supabase Auth; RLS and Edge Functions continue
 * to verify the JWT independently for every protected operation.
 */
export const primeVerifiedAuthUserCache = (session: Session | null) => {
  if (!session?.access_token || !session.user) {
    clearVerifiedAuthUserCache();
    return;
  }

  verifiedUserCacheGeneration += 1;
  verifiedUserCache = {
    accessToken: session.access_token,
    expiresAt: Date.now() + VERIFIED_USER_CACHE_TTL_MS,
    user: session.user,
  };
  verifiedUserRequest = null;
};

const getVerifiedUserForSession = async (session: Session): Promise<User | null> => {
  const accessToken = session.access_token;
  const now = Date.now();

  if (
    verifiedUserCache?.accessToken === accessToken &&
    verifiedUserCache.expiresAt > now
  ) {
    return verifiedUserCache.user;
  }

  if (verifiedUserRequest?.accessToken === accessToken) {
    return verifiedUserRequest.promise;
  }

  const requestGeneration = verifiedUserCacheGeneration;
  const request = supabase.auth
    .getUser(accessToken)
    .then(({ data: { user }, error }) => {
      throwIfAuthError(error);
      if (requestGeneration !== verifiedUserCacheGeneration) {
        return user;
      }
      if (user) {
        verifiedUserCache = {
          accessToken,
          expiresAt: Date.now() + VERIFIED_USER_CACHE_TTL_MS,
          user,
        };
      } else {
        verifiedUserCache = null;
      }
      return user;
    })
    .finally(() => {
      if (
        verifiedUserRequest?.accessToken === accessToken &&
        verifiedUserRequest.generation === requestGeneration
      ) {
        verifiedUserRequest = null;
      }
    });

  verifiedUserRequest = {
    accessToken,
    generation: requestGeneration,
    promise: request,
  };
  return request;
};

export const getCurrentAuthUser = async (): Promise<User | null> => {
  const session = await getAuthSession();
  if (!session) {
    clearVerifiedAuthUserCache();
    return null;
  }

  return getVerifiedUserForSession(session);
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
    if (isAuthSessionMissingError(error)) {
      clearVerifiedAuthUserCache();
      return null;
    }
    throw error;
  }
  if (!session) {
    clearVerifiedAuthUserCache();
    return null;
  }

  try {
    return await getVerifiedUserForSession(session);
  } catch (error) {
    if (isAuthSessionMissingError(error)) {
      clearVerifiedAuthUserCache();
      return null;
    }
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
  captchaToken,
}: EmailSignUpRequest): Promise<EmailSignUpOutcome> => {
  const normalizedEmail = normalizeAuthEmail(email);

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: metadata,
      ...(captchaToken ? { captchaToken } : {}),
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
    primeVerifiedAuthUserCache(data.session);
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
  captchaToken,
}: SignUpEmailResendRequest): Promise<void> => {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizeAuthEmail(email),
    options: {
      emailRedirectTo: redirectTo,
      ...(captchaToken ? { captchaToken } : {}),
    },
  });

  throwIfAuthError(error);
};

/**
 * Verify a short email code without leaving the current Auth context.
 *
 * A successful Supabase verification establishes and persists the session.
 * Brack additionally primes its short-lived verified-user cache so the UI does
 * not immediately issue a redundant `/auth/v1/user` request.
 */
export const verifyEmailOtp = async ({
  email,
  token,
  type,
}: VerifyEmailOtpRequest): Promise<VerifiedEmailOtpData> => {
  const normalizedToken = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new AuthProtocolError("Enter the complete six-digit email code.");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizeAuthEmail(email),
    token: normalizedToken,
    type,
  });

  throwIfAuthError(error);

  if (!data.session || !data.user) {
    throw new AuthProtocolError(
      "Email verification completed without an authenticated session.",
    );
  }

  primeVerifiedAuthUserCache(data.session);
  return { session: data.session, user: data.user };
};

export const signInWithEmailPassword = async ({
  email,
  password,
  captchaToken,
}: EmailPasswordSignInRequest) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeAuthEmail(email),
    password,
    ...(captchaToken ? { options: { captchaToken } } : {}),
  });

  throwIfAuthError(error);
  primeVerifiedAuthUserCache(data.session);
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
    primeVerifiedAuthUserCache(data.session);
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
    primeVerifiedAuthUserCache(data.session);
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
  clearVerifiedAuthUserCache();
};

export const sendPasswordResetEmail = async (
  email: string,
  redirectTo?: string,
  captchaToken?: string,
) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizeAuthEmail(email), {
    redirectTo,
    ...(captchaToken ? { captchaToken } : {}),
  });

  throwIfAuthError(error);
  return data;
};

export const updatePassword = async (password: string) => {
  const { data, error } = await supabase.auth.updateUser({ password });
  throwIfAuthError(error);
  return data;
};
