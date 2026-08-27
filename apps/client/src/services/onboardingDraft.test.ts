import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingFormData } from "@/types";
import {
  ONBOARDING_DRAFT_VERSION,
  beginOnboardingSignupAttempt,
  canAccessOnboardingSignup,
  cancelOnboardingSignupAttempt,
  clearOnboardingDraft,
  loadOnboardingDraft,
  markOnboardingDraftReady,
  onboardingDraftSchema,
  saveOnboardingDraftCollection,
} from "./onboardingDraft";

const LEGACY_ONBOARDING_DRAFT_STORAGE_KEY =
  "brack:pre-auth-onboarding:v1";

const formData: OnboardingFormData = {
  favoriteGenres: ["Fantasy", "History"],
  colorTheme: "midnight",
  slowestGenre: "History",
  preferredBookLength: "medium",
  booksReadSixMonths: 6,
  booksReadYear: 12,
  averageDaysPerBook: 21,
  preferredSessionMinutes: 20,
  preferredReadingTime: "evening",
  readingFrequency: "daily",
  motivation: "Read with more intention",
  preferredBookFormat: "mixed",
  goalTargetBooks: 18,
  goalStartDate: "2026-08-26",
  goalEndDate: "2027-08-26",
  reminderEnabled: true,
  reminderTime: "19:00",
};

const createCollection = () =>
  saveOnboardingDraftCollection({ formData, lastStep: "taste" });

describe("pre-auth onboarding draft", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearOnboardingDraft();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T12:00:00.000Z"));
  });

  afterEach(() => {
    clearOnboardingDraft();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps a complete, versioned draft only in the active module runtime", () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");

    const draft = createCollection();

    expect(draft).toMatchObject({
      version: ONBOARDING_DRAFT_VERSION,
      formData,
      stage: "collecting",
      outcome: null,
      lastStep: "taste",
      createdAt: "2026-08-26T12:00:00.000Z",
      updatedAt: "2026-08-26T12:00:00.000Z",
    });
    expect(draft).not.toHaveProperty("expiresAt");
    expect(draft?.flowId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(loadOnboardingDraft()).toEqual(draft);
    expect(storageWrite).not.toHaveBeenCalled();
    expect(
      localStorage.getItem(LEGACY_ONBOARDING_DRAFT_STORAGE_KEY),
    ).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("returns defensive copies and never retains caller-owned form objects", () => {
    const callerForm: OnboardingFormData = {
      ...formData,
      favoriteGenres: [...formData.favoriteGenres],
    };
    const returned = saveOnboardingDraftCollection({
      formData: callerForm,
      lastStep: "taste",
    })!;

    callerForm.favoriteGenres.push("Mystery");
    callerForm.colorTheme = "default";
    returned.formData.favoriteGenres.push("Romance");
    returned.formData.colorTheme = "default";
    returned.lastStep = "review";

    const firstLoad = loadOnboardingDraft()!;
    expect(firstLoad.formData.favoriteGenres).toEqual(["Fantasy", "History"]);
    expect(firstLoad.formData.colorTheme).toBe("midnight");
    expect(firstLoad.lastStep).toBe("taste");

    firstLoad.formData.favoriteGenres.length = 0;
    firstLoad.authAttempt = {
      kind: "oauth",
      provider: "google",
      startedAt: firstLoad.updatedAt,
    };

    expect(loadOnboardingDraft()).toMatchObject({
      formData: {
        favoriteGenres: ["Fantasy", "History"],
        colorTheme: "midnight",
      },
      stage: "collecting",
    });
    expect(loadOnboardingDraft()).not.toHaveProperty("authAttempt");
  });

  it("preserves flow identity while collection updates advance in-memory state", () => {
    const original = createCollection()!;
    vi.advanceTimersByTime(60_000);

    const updated = saveOnboardingDraftCollection({
      formData: { ...formData, motivation: "A revised answer" },
      lastStep: "pace",
    });

    expect(updated).toMatchObject({
      flowId: original.flowId,
      createdAt: original.createdAt,
      updatedAt: "2026-08-26T12:01:00.000Z",
      lastStep: "pace",
      stage: "collecting",
      outcome: null,
      formData: { motivation: "A revised answer" },
    });
  });

  it("moves a completed draft through ready, email auth, and cancellation", () => {
    createCollection();

    const ready = markOnboardingDraftReady({
      outcome: "completed",
      lastStep: "review",
    });
    expect(ready).toMatchObject({
      stage: "ready",
      outcome: "completed",
      lastStep: "review",
    });
    expect(canAccessOnboardingSignup()).toBe(true);

    vi.advanceTimersByTime(1_000);
    const authStarted = beginOnboardingSignupAttempt({
      kind: "email",
      email: "  Reader@Example.COM ",
    });
    expect(authStarted).toMatchObject({
      stage: "auth_started",
      outcome: "completed",
      authAttempt: {
        kind: "email",
        email: "reader@example.com",
        startedAt: "2026-08-26T12:00:01.000Z",
      },
    });
    expect(canAccessOnboardingSignup()).toBe(true);

    vi.advanceTimersByTime(1_000);
    const cancelled = cancelOnboardingSignupAttempt();
    expect(cancelled).toMatchObject({
      stage: "ready",
      outcome: "completed",
      updatedAt: "2026-08-26T12:00:02.000Z",
    });
    expect(cancelled).not.toHaveProperty("authAttempt");
    expect(cancelOnboardingSignupAttempt()).toEqual(cancelled);
  });

  it("supports skipped onboarding and normalized OAuth attempt binding", () => {
    createCollection();
    markOnboardingDraftReady({ outcome: "skipped", lastStep: "welcome" });

    const draft = beginOnboardingSignupAttempt({
      kind: "oauth",
      provider: " Google ",
    });

    expect(draft).toMatchObject({
      stage: "auth_started",
      outcome: "skipped",
      lastStep: "welcome",
      authAttempt: {
        kind: "oauth",
        provider: "google",
        startedAt: "2026-08-26T12:00:00.000Z",
      },
    });
  });

  it("does not grant signup access while answers are still collecting", () => {
    const collecting = createCollection();

    expect(canAccessOnboardingSignup(collecting)).toBe(false);
    expect(
      beginOnboardingSignupAttempt({ kind: "oauth", provider: "google" }),
    ).toBeNull();
    expect(cancelOnboardingSignupAttempt()).toBeNull();
    expect(loadOnboardingDraft()).toEqual(collecting);
  });

  it("validates complete finite form data without corrupting an active draft", () => {
    const valid = createCollection();
    const incomplete = { ...formData } as Partial<OnboardingFormData>;
    delete incomplete.goalTargetBooks;

    expect(() =>
      saveOnboardingDraftCollection({
        formData: incomplete as OnboardingFormData,
        lastStep: "goal",
      }),
    ).toThrow();
    expect(() =>
      saveOnboardingDraftCollection({
        formData: { ...formData, averageDaysPerBook: Number.NaN },
        lastStep: "pace",
      }),
    ).toThrow();
    expect(loadOnboardingDraft()).toEqual(valid);
  });

  it("rejects impossible lifecycle records at the schema boundary", () => {
    const collecting = createCollection()!;

    expect(
      onboardingDraftSchema.safeParse({
        ...collecting,
        outcome: "completed",
      }).success,
    ).toBe(false);
    expect(
      onboardingDraftSchema.safeParse({
        ...collecting,
        stage: "ready",
      }).success,
    ).toBe(false);
    expect(
      onboardingDraftSchema.safeParse({
        ...collecting,
        stage: "auth_started",
        outcome: "completed",
      }).success,
    ).toBe(false);
    expect(
      onboardingDraftSchema.safeParse({
        ...collecting,
        createdAt: "2026-08-26T12:01:00.000Z",
        updatedAt: "2026-08-26T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("clears the active flow explicitly without touching unrelated storage", () => {
    localStorage.setItem("unrelated-local", "keep");
    sessionStorage.setItem("unrelated-session", "keep");
    createCollection();

    clearOnboardingDraft();

    expect(loadOnboardingDraft()).toBeNull();
    expect(canAccessOnboardingSignup()).toBe(false);
    expect(localStorage.getItem("unrelated-local")).toBe("keep");
    expect(sessionStorage.getItem("unrelated-session")).toBe("keep");
  });

  it("purges a legacy seven-day localStorage record without hydrating it", () => {
    localStorage.setItem(
      LEGACY_ONBOARDING_DRAFT_STORAGE_KEY,
      JSON.stringify({ formData, stage: "ready", outcome: "completed" }),
    );

    expect(loadOnboardingDraft()).toBeNull();
    expect(
      localStorage.getItem(LEGACY_ONBOARDING_DRAFT_STORAGE_KEY),
    ).toBeNull();

    const active = createCollection();
    localStorage.setItem(LEGACY_ONBOARDING_DRAFT_STORAGE_KEY, "stale-again");

    expect(loadOnboardingDraft()).toEqual(active);
    expect(
      localStorage.getItem(LEGACY_ONBOARDING_DRAFT_STORAGE_KEY),
    ).toBeNull();
  });

  it("starts empty when a fresh document or app process recreates the module", async () => {
    createCollection();
    expect(loadOnboardingDraft()).not.toBeNull();

    vi.resetModules();
    const freshRuntime = await import("./onboardingDraft");

    expect(freshRuntime.loadOnboardingDraft()).toBeNull();
    freshRuntime.clearOnboardingDraft();
  });
});
