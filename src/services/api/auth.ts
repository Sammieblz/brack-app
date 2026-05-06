import type {
  AuthChangeEvent,
  AuthError,
  OAuthResponse,
  Provider,
  Session,
  Subscription,
  User,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isCustomSchemeAuthRuntime, openExternalUrl } from "@/services/platform";

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

export type AuthStateChangeHandler = (
  event: AuthChangeEvent,
  session: Session | null
) => void | Promise<void>;

const throwIfAuthError = (error: AuthError | null) => {
  if (error) throw error;
};

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
}: EmailSignUpRequest) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: metadata,
    },
  });

  throwIfAuthError(error);
  return data;
};

export const signInWithEmailPassword = async ({
  email,
  password,
}: EmailPasswordSignInRequest) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  throwIfAuthError(error);
  return data;
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
  const url = new URL(callbackUrl);
  const searchParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const error = searchParams.get("error") ?? hashParams.get("error");
  const errorDescription =
    searchParams.get("error_description") ?? hashParams.get("error_description");

  if (error) {
    throw new Error(errorDescription || error);
  }

  const code = searchParams.get("code") ?? hashParams.get("code");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    throwIfAuthError(error);
    return data;
  }

  const accessToken = searchParams.get("access_token") ?? hashParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token") ?? hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    throwIfAuthError(error);
    return data;
  }

  return null;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  throwIfAuthError(error);
};

export const sendPasswordResetEmail = async (
  email: string,
  redirectTo?: string
) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
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
