import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingFormData } from "@/types";
import {
  ONBOARDING_DRAFT_STORAGE_KEY,
  ONBOARDING_DRAFT_TTL_MS,
  ONBOARDING_DRAFT_VERSION,
  beginOnboardingSignupAttempt,
  canAccessOnboardingSignup,
  cancelOnboardingSignupAttempt,
  clearOnboardingDraft,
  loadOnboardingDraft,
  markOnboardingDraftReady,
  saveOnboardingDraftCollection,
} from "./onboardingDraft";

const formData: OnboardingFormData = {
  favoriteGenres: ["Fantasy", "History"],
  colorTheme: "default",
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("persists a complete, versioned collection with a seven-day TTL and UUID", () => {
    const draft = createCollection();

    expect(draft).toMatchObject({
      version: ONBOARDING_DRAFT_VERSION,
      formData,
      stage: "collecting",
      outcome: null,
      lastStep: "taste",
      createdAt: "2026-08-26T12:00:00.000Z",
      updatedAt: "2026-08-26T12:00:00.000Z",
      expiresAt: "2026-09-02T12:00:00.000Z",
    });
    expect(draft?.flowId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(Date.parse(draft!.expiresAt) - Date.parse(draft!.updatedAt)).toBe(
      ONBOARDING_DRAFT_TTL_MS,
    );
    expect(loadOnboardingDraft()).toEqual(draft);
  });

  it("preserves the flow identity while collection updates refresh the TTL", () => {
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
      expiresAt: "2026-09-02T12:01:00.000Z",
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
  });

  it("supports skipped onboarding and OAuth attempts", () => {
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
      },
    });
  });

  it("does not grant signup access while answers are still collecting", () => {
    const collecting = createCollection();

    expect(canAccessOnboardingSignup(collecting)).toBe(false);
    expect(beginOnboardingSignupAttempt({ kind: "oauth", provider: "google" })).toBeNull();
    expect(cancelOnboardingSignupAttempt()).toBeNull();
    expect(loadOnboardingDraft()).toEqual(collecting);
  });

  it("returns null when readiness is requested without a valid collection", () => {
    expect(markOnboardingDraftReady({ outcome: "completed" })).toBeNull();
    expect(canAccessOnboardingSignup()).toBe(false);
  });

  it("rejects incomplete or non-finite form data without persisting it", () => {
    const incomplete = { ...formData } as Partial<OnboardingFormData>;
    delete incomplete.goalTargetBooks;

    expect(() =>
      saveOnboardingDraftCollection({
        formData: incomplete as OnboardingFormData,
        lastStep: "goal",
      }),
    ).toThrow();
    expect(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)).toBeNull();

    expect(() =>
      saveOnboardingDraftCollection({
        formData: { ...formData, averageDaysPerBook: Number.NaN },
        lastStep: "pace",
      }),
    ).toThrow();
    expect(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("removes malformed, incompatible, and state-invalid records", () => {
    localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, "{not-json");
    expect(loadOnboardingDraft()).toBeNull();
    expect(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)).toBeNull();

    const valid = createCollection()!;
    localStorage.setItem(
      ONBOARDING_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...valid, version: 99 }),
    );
    expect(loadOnboardingDraft()).toBeNull();
    expect(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)).toBeNull();

    createCollection();
    const collecting = loadOnboardingDraft()!;
    localStorage.setItem(
      ONBOARDING_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...collecting, outcome: "completed" }),
    );
    expect(loadOnboardingDraft()).toBeNull();
    expect(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("expires and removes a draft exactly at the seven-day boundary", () => {
    createCollection();
    vi.advanceTimersByTime(ONBOARDING_DRAFT_TTL_MS - 1);
    expect(loadOnboardingDraft()).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(loadOnboardingDraft()).toBeNull();
    expect(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)).toBeNull();
    expect(canAccessOnboardingSignup()).toBe(false);
  });

  it("clears a persisted draft explicitly", () => {
    createCollection();
    expect(loadOnboardingDraft()).not.toBeNull();

    clearOnboardingDraft();

    expect(loadOnboardingDraft()).toBeNull();
  });
});
