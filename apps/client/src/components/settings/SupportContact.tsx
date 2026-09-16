import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AuthTurnstile, type AuthTurnstileHandle } from "@/components/auth/AuthTurnstile";
import { APP_ICONS } from "@/config/iconography";
import { useAuth } from "@/hooks/useAuth";
import { useConnectivityState } from "@/hooks/useNetworkStatus";
import { useToast } from "@/hooks/use-toast";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_EMAIL,
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_SUBJECT_MAX_LENGTH,
  submitSupportRequest,
  type SupportCategory,
} from "@/services/api";
import { getRuntimePlatform, openSupportEmail } from "@/services/platform";
import type { SupportPlatform } from "@/services/api/support";

type SubmissionState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; requestId: string }
  | { kind: "error"; message: string };

const createRequestId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};
const SUPPORT_APP_VERSIONS = ["v1.0.0"] as const;
const initialSupportPlatform = (): SupportPlatform => {
  const runtime = getRuntimePlatform();
  return runtime === "desktop" ? "desktop" : runtime === "web" ? "web" : "mobile";
};

export const SupportContact = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const connectivity = useConnectivityState();
  const turnstileRef = useRef<AuthTurnstileHandle>(null);
  const [category, setCategory] = useState<SupportCategory>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [appVersion, setAppVersion] = useState<string>(SUPPORT_APP_VERSIONS[0]);
  const [supportPlatform, setSupportPlatform] = useState<SupportPlatform>(initialSupportPlatform);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(createRequestId);
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" });
  const isOnline = connectivity !== "offline";
  const isAnonymous = !user;
  const composerAvailable = getRuntimePlatform() !== "web";

  useEffect(() => {
    setCategory("bug");
    setSubject("");
    setMessage("");
    setReplyEmail("");
    setIncludeDiagnostics(false);
    setAppVersion(SUPPORT_APP_VERSIONS[0]);
    setSupportPlatform(initialSupportPlatform());
    setTurnstileToken(null);
    setRequestId(createRequestId());
    setSubmission({ kind: "idle" });
    turnstileRef.current?.reset();
  }, [user?.id]);

  const markEdited = () => {
    if (submission.kind === "sending") return;
    if (submission.kind !== "idle") setSubmission({ kind: "idle" });
    setRequestId(createRequestId());
  };

  const validate = () => {
    if (!subject.trim()) return "Add a subject so we can route your message.";
    if (subject.trim().length > SUPPORT_SUBJECT_MAX_LENGTH) return "The subject is too long.";
    if (message.trim().length < 10) return "Add a little more detail (at least 10 characters).";
    if (message.trim().length > SUPPORT_MESSAGE_MAX_LENGTH) return "The message is too long.";
    if (isAnonymous && !replyEmail.trim()) return "Add the email address where we should reply.";
    if (isAnonymous && !turnstileToken) return "Complete the security check before sending.";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submission.kind === "sending") return;
    const validationError = validate();
    if (validationError) {
      setSubmission({ kind: "error", message: validationError });
      return;
    }
    if (!isOnline) {
      setSubmission({
        kind: "error",
        message: "You're offline. Your message is still here; send it when you're back online or copy our address.",
      });
      return;
    }

    setSubmission({ kind: "sending" });
    try {
      const result = await submitSupportRequest({
        request_id: requestId,
        category,
        subject: subject.trim(),
        message: message.trim(),
        ...(isAnonymous ? { reply_email: replyEmail.trim() } : {}),
        include_diagnostics: includeDiagnostics,
        ...(includeDiagnostics
          ? { diagnostics: { app_version: appVersion, platform: supportPlatform } }
          : {}),
        ...(isAnonymous && turnstileToken ? { turnstile_token: turnstileToken } : {}),
      });
      setSubmission({ kind: "sent", requestId: result.request_id });
      setSubject("");
      setMessage("");
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } catch {
      setSubmission({
        kind: "error",
        message: "We couldn't confirm delivery. Your message is still here—retry, email us, or copy the address below.",
      });
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  };

  const handleEmailSupport = async () => {
    const label = SUPPORT_CATEGORIES.find((item) => item.value === category)?.label ?? "Help";
    const opened = await openSupportEmail(`Brack support: ${label}`);
    if (!opened) {
      setSubmission({
        kind: "error",
        message: "No email app was available. You can send the form here or copy the support address.",
      });
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      toast({ title: "Support address copied", description: SUPPORT_EMAIL });
    } catch {
      toast({
        title: "Could not copy automatically",
        description: `Select and copy ${SUPPORT_EMAIL}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Support &amp; Help</h2>
        <p className="mt-1 font-sans text-muted-foreground">
          Tell us what happened. We usually reply within 1–2 business days.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Brack support</CardTitle>
          <CardDescription>
            This form is delivered server-side, never through browser SMTP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="support-category">Category</Label>
              <Select
                value={category}
                disabled={submission.kind === "sending"}
                onValueChange={(value: SupportCategory) => {
                  markEdited();
                  setCategory(value);
                }}
              >
                <SelectTrigger id="support-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAnonymous && (
              <div className="space-y-2">
                <Label htmlFor="support-reply-email">Email for our reply</Label>
                <Input
                  id="support-reply-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={replyEmail}
                  disabled={submission.kind === "sending"}
                  onChange={(event) => { markEdited(); setReplyEmail(event.target.value); }}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Label htmlFor="support-subject">Subject</Label>
                <span id="support-subject-count" className="text-xs text-muted-foreground">
                  {subject.length}/{SUPPORT_SUBJECT_MAX_LENGTH}
                </span>
              </div>
              <Input
                id="support-subject"
                value={subject}
                maxLength={SUPPORT_SUBJECT_MAX_LENGTH}
                aria-describedby="support-subject-count"
                disabled={submission.kind === "sending"}
                onChange={(event) => { markEdited(); setSubject(event.target.value); }}
                placeholder="What can we help with?"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Label htmlFor="support-message">What happened?</Label>
                <span id="support-message-count" className="text-xs text-muted-foreground">
                  {message.length}/{SUPPORT_MESSAGE_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="support-message"
                value={message}
                maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
                aria-describedby="support-message-count support-privacy"
                disabled={submission.kind === "sending"}
                onChange={(event) => { markEdited(); setMessage(event.target.value); }}
                placeholder="Describe what you expected and what happened."
                rows={7}
                required
              />
            </div>

            <div className="rounded-lg border bg-muted/35 p-4">
              <p className="mb-3 font-mono text-xs text-muted-foreground">
                Request ID: {requestId} (always included for delivery tracking)
              </p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="support-diagnostics"
                  checked={includeDiagnostics}
                  disabled={submission.kind === "sending"}
                  onCheckedChange={(checked) => { markEdited(); setIncludeDiagnostics(checked === true); }}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="support-diagnostics" className="cursor-pointer leading-5">
                    Include app version and platform
                  </Label>
                  {includeDiagnostics && (
                    <div className="grid gap-3 pt-2 sm:grid-cols-2" aria-label="Diagnostic summary preview">
                      <div className="space-y-2">
                        <Label htmlFor="support-app-version">App version</Label>
                        <Select value={appVersion} disabled={submission.kind === "sending"} onValueChange={(value) => { markEdited(); setAppVersion(value); }}>
                          <SelectTrigger id="support-app-version"><SelectValue /></SelectTrigger>
                          <SelectContent>{SUPPORT_APP_VERSIONS.map((version) => <SelectItem key={version} value={version}>{version}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="support-platform">Platform</Label>
                        <Select value={supportPlatform} disabled={submission.kind === "sending"} onValueChange={(value: SupportPlatform) => { markEdited(); setSupportPlatform(value); }}>
                          <SelectTrigger id="support-platform"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="web">Web</SelectItem>
                            <SelectItem value="mobile">Mobile</SelectItem>
                            <SelectItem value="desktop">Desktop</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p id="support-privacy" className="text-sm leading-6 text-muted-foreground">
              Please do not include passwords, authentication codes, private book notes, messages, precise location, or logs. The request ID tracks delivery; Brack only adds the selected app version and platform when you opt in.
            </p>

            {isAnonymous && (
              <AuthTurnstile
                ref={turnstileRef}
                action="support_contact"
                onTokenChange={setTurnstileToken}
                disabled={submission.kind === "sending"}
              />
            )}

            {submission.kind === "sent" && (
              <Alert role="status" className="border-primary/35 bg-primary/5">
                <AlertTitle>Message accepted</AlertTitle>
                <AlertDescription>
                  Brack support accepted your message. Keep request ID <span className="font-mono">{submission.requestId}</span> if you need to follow up.
                </AlertDescription>
              </Alert>
            )}
            {submission.kind === "error" && (
              <Alert variant="destructive" role="alert">
                <AlertTitle>Message not confirmed</AlertTitle>
                <AlertDescription>{submission.message}</AlertDescription>
              </Alert>
            )}
            {!isOnline && submission.kind !== "error" && (
              <Alert role="status">
                <AlertTitle>You're offline</AlertTitle>
                <AlertDescription>Your text stays in this form. Reconnect before sending; support messages are not placed in the offline sync queue.</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="sm:flex-1" disabled={!isOnline || submission.kind === "sending"}>
                <AppIcon icon={APP_ICONS.common.send} variant="inline" size="sm" />
                {submission.kind === "sending" ? "Sending securely…" : submission.kind === "error" ? "Retry send" : "Send to support"}
              </Button>
              {composerAvailable && (
                <Button type="button" variant="outline" onClick={handleEmailSupport} disabled={submission.kind === "sending"}>
                  <AppIcon icon={APP_ICONS.settings.contact} variant="inline" size="sm" />
                  Email support
                </Button>
              )}
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-5 text-sm">
            <span className="text-muted-foreground">Prefer to write directly?</span>
            <span className="select-all font-medium">{SUPPORT_EMAIL}</span>
            <Button type="button" variant="ghost" size="sm" onClick={copyAddress} aria-label="Copy support email address">
              <AppIcon icon={APP_ICONS.common.copy} variant="inline" size="sm" />
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
