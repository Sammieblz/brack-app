import type { Book, Goal } from "@/types";
import { invokeFunction } from "./client";
import type { AwardedBadge } from "./badges";
import { withContentSnapshot } from "@/services/contentSnapshots";

export type DashboardLastActivityType =
  | "progress_log"
  | "reading_session"
  | "book_update"
  | "date_started"
  | "created";

export interface DashboardBookCandidate {
  book: Book;
  lastActivityAt: string;
  lastActivityType: DashboardLastActivityType;
  progressPercent: number;
  ctaLabel: string;
}

export interface DashboardTodaySummary {
  minutes: number;
  sessionCount: number;
  progressMinutes?: number;
  progressLogCount: number;
}

export interface DashboardStreakSummary {
  currentStreak: number;
  longestStreak: number;
  lastReadingDate: string | null;
  freezeUsedAt: string | null;
}

export interface DashboardCoreStats {
  totalBooks: number;
  completedBooks: number;
  readingBooks: number;
  toReadBooks: number;
  pagesRead: number;
  readingMinutes: number;
}

export interface DashboardRecentActivity {
  id: string;
  type: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface DashboardHomeResponse {
  continueBooks: DashboardBookCandidate[];
  activeGoal: Goal | null;
  today: DashboardTodaySummary;
  streak: DashboardStreakSummary;
  stats: DashboardCoreStats;
  recentActivity: DashboardRecentActivity[];
  achievements: AwardedBadge[];
}

export const getDashboardHome = async (recentLimit = 10): Promise<DashboardHomeResponse> => {
  return withContentSnapshot("dashboard", `home:${recentLimit}`, () =>
    invokeFunction<DashboardHomeResponse>("dashboard-home", {
      body: { recent_limit: recentLimit },
    }),
  );
};
