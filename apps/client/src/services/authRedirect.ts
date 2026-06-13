import {
  getCurrentAuthUser,
  handleAuthCallbackUrl,
} from "@/services/api/auth";
import {
  ensureUserProfile,
  shouldEnterFirstRunOnboarding,
} from "@/services/onboarding";
import { isPasswordResetUrl } from "@/services/platform";

export const resolvePostAuthPath = async () => {
  const user = await getCurrentAuthUser();

  if (!user) {
    return "/auth";
  }

  const status = await ensureUserProfile(user);
  return shouldEnterFirstRunOnboarding(user, status) ? "/onboarding" : "/dashboard";
};

export const completeAuthCallback = async (callbackUrl: string) => {
  await handleAuthCallbackUrl(callbackUrl);
  if (isPasswordResetUrl(callbackUrl)) {
    return "/auth/reset-password";
  }
  return resolvePostAuthPath();
};
