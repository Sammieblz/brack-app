import {
  getCurrentAuthUser,
  handleAuthCallbackUrl,
} from "@/services/api/auth";
import {
  ensureUserProfile,
  saveOnboardingProfile,
  shouldEnterFirstRunOnboarding,
  skipOnboarding,
} from "@/services/onboarding";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  type OnboardingDraft,
} from "@/services/onboardingDraft";
import {
  arePostSignupPermissionsPending,
  markPostSignupPermissionsPending,
} from "@/services/postSignupPermissions";
import { isMobileNativeRuntime, isPasswordResetUrl } from "@/services/platform";

const CALLBACK_REPLAY_TTL_MS = 5 * 60 * 1000;
const MAX_CALLBACK_REPLAYS = 32;
const RECOVERY_AUTHORIZATION_TTL_MS = 15 * 60 * 1000;
const RECOVERY_AUTHORIZATION_KEY = "brack:password-recovery-authorization:v1";

type CallbackCompletion = {
  promise: Promise<string>;
  settled: boolean;
  expiresAt: number;
};

type RecoveryAuthorization = {
  version: 1;
  userId: string;
  expiresAt: number;
};

type AuthCallbackResult = {
  user?: { id?: string } | null;
  session?: { user?: { id?: string } | null } | null;
};

const callbackCompletions = new Map<string, CallbackCompletion>();
const onboardingFinalizations = new Map<string, Promise<string>>();
let inMemoryRecoveryAuthorization: RecoveryAuthorization | null = null;

export class AuthCallbackCredentialError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AuthCallbackCredentialError";
  }
}

export class AuthCallbackBootstrapError extends Error {
  readonly fallbackPath = "/dashboard";

  constructor(public readonly cause?: unknown) {
    super("Your sign-in succeeded, but Brack could not finish loading your account.");
    this.name = "AuthCallbackBootstrapError";
  }
}

const getCallbackParams = (callbackUrl: string) => {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch (error) {
    throw new AuthCallbackCredentialError(
      "This sign-in link is invalid. Request a fresh link and try again.",
      error,
    );
  }

  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const readParam = (name: string) =>
    parsed.searchParams.get(name) ?? hashParams.get(name);

  return {
    hasProviderError: Boolean(readParam("error")),
    code: readParam("code"),
    accessToken: readParam("access_token"),
    refreshToken: readParam("refresh_token"),
  };
};

const assertCallbackCredentials = (callbackUrl: string) => {
  const { hasProviderError, code, accessToken, refreshToken } =
    getCallbackParams(callbackUrl);

  if (hasProviderError || code || (accessToken && refreshToken)) return;

  throw new AuthCallbackCredentialError(
    accessToken || refreshToken
      ? "This sign-in link is incomplete. Request a fresh link and try again."
      : "This sign-in link has no authentication credentials. Request a fresh link and try again.",
  );
};

const fallbackFingerprint = (value: string) => {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }

  return `fallback-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
};

const fingerprintCallback = async (callbackUrl: string) => {
  if (!globalThis.crypto?.subtle) return fallbackFingerprint(callbackUrl);

  try {
    const bytes = new TextEncoder().encode(callbackUrl);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return fallbackFingerprint(callbackUrl);
  }
};

const pruneCallbackCompletions = (now: number) => {
  for (const [fingerprint, completion] of callbackCompletions) {
    if (completion.settled && completion.expiresAt <= now) {
      callbackCompletions.delete(fingerprint);
    }
  }
};

const makeRoomForCallbackCompletion = () => {
  while (callbackCompletions.size >= MAX_CALLBACK_REPLAYS) {
    const oldestSettled = Array.from(callbackCompletions).find(
      ([, completion]) => completion.settled,
    );
    if (!oldestSettled) break;
    callbackCompletions.delete(oldestSettled[0]);
  }
};

const getSessionStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

const removeRecoveryAuthorization = () => {
  inMemoryRecoveryAuthorization = null;
  try {
    getSessionStorage()?.removeItem(RECOVERY_AUTHORIZATION_KEY);
  } catch {
    // The in-memory marker still prevents an ordinary session from authorizing a reset.
  }
};

const writeRecoveryAuthorization = (userId: string) => {
  const authorization: RecoveryAuthorization = {
    version: 1,
    userId,
    expiresAt: Date.now() + RECOVERY_AUTHORIZATION_TTL_MS,
  };

  inMemoryRecoveryAuthorization = authorization;
  try {
    getSessionStorage()?.setItem(
      RECOVERY_AUTHORIZATION_KEY,
      JSON.stringify(authorization),
    );
  } catch {
    // Native/private storage can be unavailable; the current runtime keeps a marker in memory.
  }
};

/**
 * Record a short-lived password-reset authorization after Supabase has
 * verified a recovery OTP or recovery callback for this exact user.
 */
export const authorizePasswordRecoverySession = (userId: string) => {
  if (!userId) {
    throw new AuthCallbackCredentialError(
      "A verified recovery user is required to authorize a password reset.",
    );
  }

  writeRecoveryAuthorization(userId);
};

const readRecoveryAuthorization = (): RecoveryAuthorization | null => {
  let authorization = inMemoryRecoveryAuthorization;

  try {
    const storedValue = getSessionStorage()?.getItem(RECOVERY_AUTHORIZATION_KEY);
    if (storedValue) {
      const parsed = JSON.parse(storedValue) as Partial<RecoveryAuthorization>;
      if (
        parsed.version === 1 &&
        typeof parsed.userId === "string" &&
        typeof parsed.expiresAt === "number"
      ) {
        authorization = parsed as RecoveryAuthorization;
        inMemoryRecoveryAuthorization = authorization;
      } else {
        removeRecoveryAuthorization();
        return null;
      }
    }
  } catch {
    // Fall through to the in-memory marker when storage is unavailable or malformed.
  }

  if (!authorization || authorization.expiresAt <= Date.now()) {
    removeRecoveryAuthorization();
    return null;
  }

  return authorization;
};

export const hasPasswordRecoveryAuthorization = (userId: string) =>
  readRecoveryAuthorization()?.userId === userId;

export const consumePasswordRecoveryAuthorization = (userId: string) => {
  if (!hasPasswordRecoveryAuthorization(userId)) return false;
  removeRecoveryAuthorization();
  return true;
};

const isDraftForNewlyCreatedUser = (
  draft: OnboardingDraft,
  user: Awaited<ReturnType<typeof getCurrentAuthUser>>,
) => {
  if (!user || draft.stage !== "auth_started" || !draft.authAttempt) return false;

  const userCreatedAt = Date.parse(user.created_at);
  const attemptStartedAt = Date.parse(draft.authAttempt.startedAt);
  if (!Number.isFinite(userCreatedAt) || !Number.isFinite(attemptStartedAt)) return false;

  // Server/client clocks may differ. A genuine account creation still occurs
  // close to the signup request, while an established Google/email account does not.
  const earliestAllowed = attemptStartedAt - 10 * 60_000;
  const latestAllowed = attemptStartedAt + 30 * 60_000;
  if (userCreatedAt < earliestAllowed || userCreatedAt > latestAllowed) return false;

  if (draft.authAttempt.kind === "email") {
    return user.email?.trim().toLowerCase() === draft.authAttempt.email;
  }

  const provider = draft.authAttempt.provider;
  const metadataProviders = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  const identityProviders = Array.isArray(user.identities)
    ? user.identities.map((identity) => identity.provider)
    : [];
  const verifiedProviders = new Set(
    [user.app_metadata?.provider, ...metadataProviders, ...identityProviders]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLowerCase()),
  );

  return provider === "google" && verifiedProviders.has(provider);
};

const finalizeOnboardingDraft = async (
  draft: OnboardingDraft,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentAuthUser>>>,
  status: Awaited<ReturnType<typeof ensureUserProfile>>,
) => {
  const finalizationKey = `${user.id}:${draft.flowId}`;
  const active = onboardingFinalizations.get(finalizationKey);
  if (active) return active;

  const completion = (async () => {
    if (!shouldEnterFirstRunOnboarding(user, status)) {
      clearOnboardingDraft();
      return "/dashboard";
    }

    if (!isDraftForNewlyCreatedUser(draft, user)) {
      clearOnboardingDraft();
      return "/onboarding";
    }

    try {
      if (draft.outcome === "skipped") {
        await skipOnboarding(user.id, draft.lastStep);
      } else {
        await saveOnboardingProfile(user.id, draft.formData, {
          goalId: draft.flowId,
        });
      }

      if (isMobileNativeRuntime()) {
        markPostSignupPermissionsPending(user.id);
      }
      clearOnboardingDraft();
      return isMobileNativeRuntime() ? "/app-permissions" : "/dashboard";
    } catch (error) {
      console.error("Unable to apply the pre-auth onboarding profile:", error);
      // Keep the validated draft so authenticated onboarding can retry without
      // asking the reader to reconstruct their answers.
      return "/onboarding?resume=draft";
    }
  })().finally(() => {
    onboardingFinalizations.delete(finalizationKey);
  });

  onboardingFinalizations.set(finalizationKey, completion);
  return completion;
};

export const resolvePostAuthPath = async () => {
  const user = await getCurrentAuthUser();

  if (!user) {
    return "/auth";
  }

  if (arePostSignupPermissionsPending(user.id)) return "/app-permissions";

  const status = await ensureUserProfile(user);
  const draft = loadOnboardingDraft();
  if (draft?.stage === "auth_started") {
    return finalizeOnboardingDraft(draft, user, status);
  }

  if (draft && (status.onboarding_status === "completed" || status.onboarding_status === "skipped")) {
    clearOnboardingDraft();
  }

  return shouldEnterFirstRunOnboarding(user, status) ? "/onboarding" : "/dashboard";
};

const processAuthCallback = async (callbackUrl: string) => {
  assertCallbackCredentials(callbackUrl);

  let callbackResult: AuthCallbackResult;
  try {
    callbackResult = await handleAuthCallbackUrl(callbackUrl);
  } catch (error) {
    throw new AuthCallbackCredentialError(
      error instanceof Error
        ? error.message
        : "This sign-in link could not be completed.",
      error,
    );
  }

  if (isPasswordResetUrl(callbackUrl)) {
    const userId = callbackResult.user?.id ?? callbackResult.session?.user?.id;
    if (!userId) {
      throw new AuthCallbackCredentialError(
        "This password reset link did not establish a recovery session. Request a fresh link and try again.",
      );
    }

    authorizePasswordRecoverySession(userId);
    return "/auth/reset-password";
  }

  try {
    const nextPath = await resolvePostAuthPath();
    if (nextPath === "/auth") throw new Error("Authenticated user was unavailable");
    return nextPath;
  } catch (error) {
    throw new AuthCallbackBootstrapError(error);
  }
};

export const completeAuthCallback = async (callbackUrl: string) => {
  const fingerprint = await fingerprintCallback(callbackUrl);
  const now = Date.now();
  pruneCallbackCompletions(now);

  const existingCompletion = callbackCompletions.get(fingerprint);
  if (existingCompletion) return existingCompletion.promise;
  makeRoomForCallbackCompletion();

  const completion: CallbackCompletion = {
    promise: Promise.resolve(""),
    settled: false,
    expiresAt: Number.POSITIVE_INFINITY,
  };

  completion.promise = processAuthCallback(callbackUrl).finally(() => {
    completion.settled = true;
    completion.expiresAt = Date.now() + CALLBACK_REPLAY_TTL_MS;
  });
  callbackCompletions.set(fingerprint, completion);

  return completion.promise;
};
