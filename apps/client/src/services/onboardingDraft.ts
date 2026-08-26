import { z } from "zod";
import type {
  OnboardingFormData,
  PreferredBookFormat,
  PreferredBookLength,
  PreferredReadingTime,
  ReadingFrequency,
} from "@/types";
import type { OnboardingStepId } from "@/services/onboarding";

export const ONBOARDING_DRAFT_VERSION = 1 as const;
export const ONBOARDING_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ONBOARDING_DRAFT_STORAGE_KEY =
  "brack:pre-auth-onboarding:v1";

const ONBOARDING_STEP_VALUES = [
  "welcome",
  "palette",
  "taste",
  "pace",
  "goal",
  "review",
] as const satisfies readonly OnboardingStepId[];

const PREFERRED_BOOK_LENGTH_VALUES = [
  "",
  "short",
  "medium",
  "long",
  "varied",
] as const satisfies readonly (PreferredBookLength | "")[];

const PREFERRED_READING_TIME_VALUES = [
  "",
  "morning",
  "afternoon",
  "evening",
  "night",
  "mixed",
] as const satisfies readonly (PreferredReadingTime | "")[];

const READING_FREQUENCY_VALUES = [
  "",
  "daily",
  "weekdays",
  "weekends",
  "few_weekly",
  "occasional",
] as const satisfies readonly (ReadingFrequency | "")[];

const PREFERRED_BOOK_FORMAT_VALUES = [
  "",
  "print",
  "ebook",
  "audio",
  "mixed",
] as const satisfies readonly (PreferredBookFormat | "")[];

const finiteNullableNumberSchema = z.number().finite().nullable();
const timestampSchema = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");

/**
 * The persisted draft must always contain the complete form shape. Keeping the
 * schema structural (rather than enforcing completion rules) lets readers save
 * valid intermediate states such as an empty genre list while they are still
 * moving through onboarding.
 */
export const onboardingDraftFormSchema = z
  .object({
    favoriteGenres: z.array(z.string()),
    colorTheme: z.string(),
    slowestGenre: z.string(),
    preferredBookLength: z.enum(PREFERRED_BOOK_LENGTH_VALUES),
    booksReadSixMonths: finiteNullableNumberSchema,
    booksReadYear: finiteNullableNumberSchema,
    averageDaysPerBook: finiteNullableNumberSchema,
    preferredSessionMinutes: finiteNullableNumberSchema,
    preferredReadingTime: z.enum(PREFERRED_READING_TIME_VALUES),
    readingFrequency: z.enum(READING_FREQUENCY_VALUES),
    motivation: z.string(),
    preferredBookFormat: z.enum(PREFERRED_BOOK_FORMAT_VALUES),
    goalTargetBooks: finiteNullableNumberSchema,
    goalStartDate: z.string().nullable(),
    goalEndDate: z.string().nullable(),
    reminderEnabled: z.boolean(),
    reminderTime: z.string().nullable(),
  })
  .strict();

export type OnboardingDraftStage =
  | "collecting"
  | "ready"
  | "auth_started";
export type OnboardingDraftOutcome = "completed" | "skipped";

export type OnboardingDraftAuthAttempt =
  | {
      kind: "email";
      email: string;
      startedAt: string;
    }
  | {
      kind: "oauth";
      provider: string;
      startedAt: string;
    };

export interface OnboardingDraft {
  version: typeof ONBOARDING_DRAFT_VERSION;
  flowId: string;
  formData: OnboardingFormData;
  stage: OnboardingDraftStage;
  outcome: OnboardingDraftOutcome | null;
  lastStep: OnboardingStepId;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  authAttempt?: OnboardingDraftAuthAttempt;
}

const authAttemptSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("email"),
      email: z.string().trim().email(),
      startedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("oauth"),
      provider: z.string().trim().min(1).max(64),
      startedAt: timestampSchema,
    })
    .strict(),
]);

export const onboardingDraftSchema = z
  .object({
    version: z.literal(ONBOARDING_DRAFT_VERSION),
    flowId: z.string().uuid(),
    formData: onboardingDraftFormSchema,
    stage: z.enum(["collecting", "ready", "auth_started"]),
    outcome: z.enum(["completed", "skipped"]).nullable(),
    lastStep: z.enum(ONBOARDING_STEP_VALUES),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    expiresAt: timestampSchema,
    authAttempt: authAttemptSchema.optional(),
  })
  .strict()
  .superRefine((draft, context) => {
    const hasOutcome = draft.outcome !== null;
    const hasAuthAttempt = draft.authAttempt !== undefined;

    if (draft.stage === "collecting" && (hasOutcome || hasAuthAttempt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A collecting draft cannot have an outcome or auth attempt.",
      });
    }

    if (draft.stage === "ready" && (!hasOutcome || hasAuthAttempt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A ready draft requires an outcome and no auth attempt.",
      });
    }

    if (draft.stage === "auth_started" && (!hasOutcome || !hasAuthAttempt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An auth-started draft requires an outcome and auth attempt.",
      });
    }

    const createdAt = Date.parse(draft.createdAt);
    const updatedAt = Date.parse(draft.updatedAt);
    const expiresAt = Date.parse(draft.expiresAt);
    if (createdAt > updatedAt || updatedAt > expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Draft timestamps are out of order.",
      });
    }
  });

export interface SaveOnboardingDraftCollectionInput {
  formData: OnboardingFormData;
  lastStep: OnboardingStepId;
}

export interface MarkOnboardingDraftReadyInput {
  outcome: OnboardingDraftOutcome;
  lastStep?: OnboardingStepId;
}

export type BeginOnboardingSignupAttemptInput =
  | { kind: "email"; email: string }
  | { kind: "oauth"; provider: string };

const getStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const createFlowId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
};

const persistDraft = (draft: OnboardingDraft) => {
  const validated = onboardingDraftSchema.parse(draft) as OnboardingDraft;
  const storage = getStorage();
  if (!storage) return null;

  try {
    const serialized = JSON.stringify(validated);
    storage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, serialized);
    // Returning the JSON representation keeps optional fields consistent with
    // what a subsequent load observes (undefined properties are not persisted).
    return JSON.parse(serialized) as OnboardingDraft;
  } catch {
    return null;
  }
};

const removeStoredDraft = () => {
  try {
    getStorage()?.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
  } catch {
    // A blocked storage backend is already equivalent to having no draft.
  }
};

export const clearOnboardingDraft = () => {
  removeStoredDraft();
};

export const loadOnboardingDraft = (): OnboardingDraft | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const stored = storage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
    if (!stored) return null;

    const parsed = onboardingDraftSchema.safeParse(JSON.parse(stored));
    if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now()) {
      removeStoredDraft();
      return null;
    }

    return parsed.data as OnboardingDraft;
  } catch {
    removeStoredDraft();
    return null;
  }
};

export const saveOnboardingDraftCollection = ({
  formData,
  lastStep,
}: SaveOnboardingDraftCollectionInput): OnboardingDraft | null => {
  const validatedFormData = onboardingDraftFormSchema.parse(
    formData,
  ) as OnboardingFormData;
  const existing = loadOnboardingDraft();
  const now = new Date();
  const timestamp = now.toISOString();

  return persistDraft({
    version: ONBOARDING_DRAFT_VERSION,
    flowId: existing?.flowId ?? createFlowId(),
    formData: validatedFormData,
    stage: "collecting",
    outcome: null,
    lastStep,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    expiresAt: new Date(now.getTime() + ONBOARDING_DRAFT_TTL_MS).toISOString(),
  });
};

export const markOnboardingDraftReady = ({
  outcome,
  lastStep,
}: MarkOnboardingDraftReadyInput): OnboardingDraft | null => {
  const existing = loadOnboardingDraft();
  if (!existing) return null;

  const now = new Date();
  return persistDraft({
    ...existing,
    stage: "ready",
    outcome,
    lastStep: lastStep ?? existing.lastStep,
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ONBOARDING_DRAFT_TTL_MS).toISOString(),
    authAttempt: undefined,
  });
};

export const beginOnboardingSignupAttempt = (
  attempt: BeginOnboardingSignupAttemptInput,
): OnboardingDraft | null => {
  const existing = loadOnboardingDraft();
  if (!existing || !canAccessOnboardingSignup(existing)) return null;

  const now = new Date();
  const authAttempt: OnboardingDraftAuthAttempt =
    attempt.kind === "email"
      ? {
          kind: "email",
          email: attempt.email.trim().toLowerCase(),
          startedAt: now.toISOString(),
        }
      : {
          kind: "oauth",
          provider: attempt.provider.trim().toLowerCase(),
          startedAt: now.toISOString(),
        };

  return persistDraft({
    ...existing,
    stage: "auth_started",
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ONBOARDING_DRAFT_TTL_MS).toISOString(),
    authAttempt,
  });
};

export const cancelOnboardingSignupAttempt = (): OnboardingDraft | null => {
  const existing = loadOnboardingDraft();
  if (!existing || !canAccessOnboardingSignup(existing)) return null;
  if (existing.stage === "ready") return existing;

  const now = new Date();
  return persistDraft({
    ...existing,
    stage: "ready",
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ONBOARDING_DRAFT_TTL_MS).toISOString(),
    authAttempt: undefined,
  });
};

export const canAccessOnboardingSignup = (
  draft: OnboardingDraft | null = loadOnboardingDraft(),
) =>
  Boolean(
    draft &&
      draft.outcome &&
      (draft.stage === "ready" || draft.stage === "auth_started"),
  );
