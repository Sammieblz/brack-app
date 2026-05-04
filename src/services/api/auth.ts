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
    },
  });

  throwIfAuthError(error);
  return data;
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
