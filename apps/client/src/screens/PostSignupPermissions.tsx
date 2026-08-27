import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellNotification,
  Camera,
  CheckCircle,
  MapPin,
  NavArrowRight,
  ShieldCheck,
} from "iconoir-react";

import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { completePostSignupPermissions } from "@/services/postSignupPermissions";
import { isMobileNativeRuntime } from "@/services/platform";
import {
  pushNotificationsService,
  type NativePushPermissionState,
} from "@/services/pushNotifications";

type PermissionUiState = NativePushPermissionState | "checking" | "error";
type RegistrationUiState = "idle" | "registered" | "failed";

const permissionCopy: Record<PermissionUiState, string> = {
  checking: "Checking this device…",
  granted: "Notification access is allowed",
  denied: "Notifications are blocked in system settings",
  prompt: "Ready when you choose Enable notifications",
  "prompt-with-rationale": "Ready when you choose Enable notifications",
  unavailable: "Notifications are unavailable on this device",
  error: "Brack could not check notification access",
};

const PostSignupPermissions = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [permissionState, setPermissionState] =
    useState<PermissionUiState>("checking");
  const [registrationState, setRegistrationState] =
    useState<RegistrationUiState>("idle");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth?mode=signin", { replace: true });
      return;
    }
    if (!isMobileNativeRuntime()) {
      navigate("/dashboard", { replace: true });
      return;
    }

    let active = true;
    pushNotificationsService
      .getPermissionState()
      .then((state) => {
        if (!active) return;
        setPermissionState(state);
        if (state === "granted" && pushNotificationsService.hasStoredRegistration()) {
          setRegistrationState("registered");
        }
      })
      .catch(() => {
        if (active) setPermissionState("error");
      });

    return () => {
      active = false;
    };
  }, [authLoading, navigate, user]);

  const finish = () => {
    if (!user) return;
    completePostSignupPermissions(user.id);
    navigate("/dashboard", { replace: true });
  };

  const enableNotifications = async () => {
    if (requesting) return;
    setRequesting(true);
    setRegistrationState("idle");

    try {
      // This is the only eager OS permission request in the acquisition flow,
      // and it follows the explanatory in-app prompt above.
      const result = await pushNotificationsService.registerWithResult();
      const nextPermission = await pushNotificationsService.getPermissionState();
      setPermissionState(nextPermission);
      setRegistrationState(result.status === "registered" ? "registered" : "failed");
    } catch (error) {
      console.error("Unable to finish native notification setup:", error);
      setPermissionState("error");
      setRegistrationState("failed");
    } finally {
      setRequesting(false);
    }
  };

  const notificationsGranted =
    permissionState === "granted" && registrationState === "registered";
  const notificationsBlocked = permissionState === "denied";
  const canAttemptRegistration =
    !notificationsBlocked && permissionState !== "unavailable";

  const notificationStatus =
    registrationState === "failed" && permissionState === "granted"
      ? "Access is allowed, but this device could not connect. Check your connection and retry."
      : registrationState === "registered"
        ? "This device is connected for reading notifications"
        : permissionState === "granted"
          ? "Access is allowed; connect this device to finish setup"
          : permissionCopy[permissionState];

  return (
    <main className="relative flex min-h-app-viewport items-center justify-center overflow-hidden bg-gradient-background px-4 py-8 safe-top safe-bottom">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-3xl">
        <div className="mb-6 text-center">
          <ThemeAwareLogo
            variant="icon"
            size="h-14 w-14"
            className="mx-auto drop-shadow-lg"
          />
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Your Brack is ready
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
            Choose what Brack may use
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Permissions are optional and belong to this device. Brack asks only when a feature needs them, and your choices can be changed later.
          </p>
        </div>

        <Card className="border-border/60 bg-card/95 shadow-medium backdrop-blur">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div
              className={cn(
                "flex min-h-24 items-start gap-4 rounded-2xl border p-4 transition-colors",
                notificationsGranted
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-muted/20",
              )}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary shadow-soft">
                {notificationsGranted ? (
                  <CheckCircle className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <BellNotification className="h-6 w-6" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-bold text-foreground">
                  Useful notifications
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Get reading reminders, timer updates, messages, and earned rewards. No marketing; choose individual categories anytime in Settings.
                </p>
                <p
                  className={cn(
                    "mt-2 text-xs font-semibold",
                    registrationState === "failed" ? "text-destructive" : "text-foreground",
                  )}
                  role="status"
                  aria-live="polite"
                >
                  {notificationStatus}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-h-28 items-start gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground shadow-soft">
                  <Camera className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-bold text-foreground">
                    Camera and photos
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Asked only when you scan an ISBN, take a chosen photo, or select a cover, profile, journal, or progress image.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-foreground">
                    Requested later, in context
                  </p>
                </div>
              </div>

              <div className="flex min-h-28 items-start gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground shadow-soft">
                  <MapPin className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-bold text-foreground">
                    Nearby reader area
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Asked only if you tap Use Current Location. You control whether nearby discovery is visible.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-foreground">
                    Requested later, in context
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Camera, photos, and location are never requested from this screen. Declining any permission does not block the reading experience.
            </div>

            {!notificationsGranted && canAttemptRegistration && (
              <Button
                type="button"
                className="h-12 w-full"
                onClick={enableNotifications}
                disabled={requesting || permissionState === "checking"}
              >
                {requesting
                  ? "Connecting this device…"
                  : registrationState === "failed"
                    ? "Retry notification setup"
                    : permissionState === "granted"
                      ? "Finish notification setup"
                      : "Enable useful notifications"}
              </Button>
            )}

            {notificationsBlocked && (
              <p className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                This device has already declined notifications. Brack will not keep prompting; enable them later from the device's app settings if you change your mind.
              </p>
            )}

            <Button
              type="button"
              variant={notificationsGranted || notificationsBlocked ? "default" : "outline"}
              className="h-12 w-full"
              onClick={finish}
            >
              {notificationsGranted ? "Continue to Brack" : "Continue without notifications"}
              <NavArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default PostSignupPermissions;
