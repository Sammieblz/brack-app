import type { ReadingSession, ReadingStreakDay } from "@/types";

interface StreakProfile {
  longest_streak?: number | null;
  streak_freeze_used_at?: string | null;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastReadingDate: string | null;
  canUseFreezeToday: boolean;
  freezeAvailable: boolean;
  hasReadingToday: boolean;
  usedFreezeToday: boolean;
}

export interface DayActivity {
  date: string;
  hasActivity: boolean;
  sessionCount: number;
  progressLogCount: number;
  totalMinutes: number;
  usedFreeze: boolean;
  source: "none" | "reading" | "freeze";
}

/**
 * Calculate streak information from persisted daily streak records.
 */
export const calculateStreakFromDays = (
  days: ReadingStreakDay[],
  profile: StreakProfile | null
): StreakData => {
  const daysByDate = normalizeStreakDays(days);
  const uniqueDates = Array.from(daysByDate.keys()).sort();
  const latestReadingDate = [...uniqueDates].reverse().find((date) => {
    const day = daysByDate.get(date);
    return Boolean(day && (day.session_count > 0 || day.progress_log_count > 0));
  }) ?? null;
  const freezeAvailable = canUseStreakFreeze(profile);

  if (uniqueDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: profile?.longest_streak || 0,
      lastReadingDate: latestReadingDate,
      canUseFreezeToday: false,
      freezeAvailable,
      hasReadingToday: false,
      usedFreezeToday: false,
    };
  }

  const today = getTodayDateString();
  const yesterday = addDays(today, -1);
  const hasActivityToday = daysByDate.has(today);
  const hasActivityYesterday = daysByDate.has(yesterday);
  const todayActivity = daysByDate.get(today);
  const hasReadingToday = Boolean(
    todayActivity &&
      (todayActivity.session_count > 0 || todayActivity.progress_log_count > 0)
  );
  const usedFreezeToday = Boolean(todayActivity?.used_freeze && !hasReadingToday);

  let currentStreak = 0;
  let checkDate: string | null = null;

  if (hasActivityToday) {
    checkDate = today;
  } else if (hasActivityYesterday) {
    checkDate = yesterday;
  }

  while (checkDate && daysByDate.has(checkDate)) {
    currentStreak++;
    checkDate = addDays(checkDate, -1);
  }

  let longestStreak = 0;
  let tempStreak = 0;
  let previousDate: string | null = null;

  uniqueDates.forEach((date) => {
    if (!previousDate) {
      tempStreak = 1;
    } else if (getDayDifference(previousDate, date) === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }

    longestStreak = Math.max(longestStreak, tempStreak);
    previousDate = date;
  });

  longestStreak = Math.max(longestStreak, profile?.longest_streak || 0);

  return {
    currentStreak,
    longestStreak,
    lastReadingDate: latestReadingDate,
    canUseFreezeToday: !hasActivityToday && hasActivityYesterday,
    freezeAvailable,
    hasReadingToday,
    usedFreezeToday,
  };
};

/**
 * Backwards-compatible helper for older callers that only have sessions.
 */
export const calculateStreakFromSessions = (
  sessions: ReadingSession[],
  profile: StreakProfile | null
): StreakData => calculateStreakFromDays(sessionsToStreakDays(sessions), profile);

/**
 * Check if user can use streak freeze (once per week)
 */
export const canUseStreakFreeze = (profile: StreakProfile | null): boolean => {
  if (!profile || !profile.streak_freeze_used_at) return true;
  
  const lastUsed = new Date(profile.streak_freeze_used_at);
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  
  return lastUsed < weekAgo;
};

/**
 * Get activity calendar data for the last N days from persisted daily records.
 */
export const getActivityCalendarFromDays = (
  streakDays: ReadingStreakDay[],
  dayCount: number = 90
): DayActivity[] => {
  const result: DayActivity[] = [];
  const streakDaysByDate = normalizeStreakDays(streakDays);

  for (let i = dayCount - 1; i >= 0; i--) {
    const dateStr = addDays(getTodayDateString(), -i);
    const streakDay = streakDaysByDate.get(dateStr);
    const sessionCount = streakDay?.session_count || 0;
    const progressLogCount = streakDay?.progress_log_count || 0;
    const usedFreeze = Boolean(streakDay?.used_freeze);
    const hasReadingActivity = sessionCount > 0 || progressLogCount > 0;
    const hasActivity = hasReadingActivity || usedFreeze;
    
    result.push({
      date: dateStr,
      hasActivity,
      sessionCount,
      progressLogCount,
      totalMinutes: streakDay?.total_minutes || 0,
      usedFreeze,
      source: hasReadingActivity ? "reading" : usedFreeze ? "freeze" : "none",
    });
  }

  return result;
};

/**
 * Backwards-compatible helper for older callers that only have sessions.
 */
export const getActivityCalendar = (
  sessions: ReadingSession[],
  days: number = 90
): DayActivity[] => getActivityCalendarFromDays(sessionsToStreakDays(sessions), days);

/**
 * Get streak milestone achievements
 */
export const getStreakMilestones = (streak: number): string[] => {
  const milestones = [
    { value: 3, label: "3-day streak!" },
    { value: 7, label: "Week streak!" },
    { value: 14, label: "2-week streak!" },
    { value: 30, label: "Month streak!" },
    { value: 60, label: "2-month streak!" },
    { value: 100, label: "100-day streak!" },
    { value: 365, label: "Year streak!" },
  ];

  return milestones
    .filter((m) => streak >= m.value && streak < m.value + 7)
    .map((m) => m.label);
};

const getTodayDateString = () => new Date().toISOString().split("T")[0];

const addDays = (dateString: string, offset: number) => {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().split("T")[0];
};

const getDayDifference = (previousDate: string, nextDate: string) => {
  const previous = new Date(`${previousDate}T00:00:00.000Z`).getTime();
  const next = new Date(`${nextDate}T00:00:00.000Z`).getTime();
  return Math.round((next - previous) / 86400000);
};

const getSessionDate = (session: ReadingSession) => {
  const dateValue = session.start_time || session.created_at;
  return dateValue ? new Date(dateValue).toISOString().split("T")[0] : null;
};

const sessionsToStreakDays = (sessions: ReadingSession[]): ReadingStreakDay[] => {
  const grouped = new Map<
    string,
    {
      userId: string;
      sessionCount: number;
      totalMinutes: number;
    }
  >();

  sessions.forEach((session) => {
    const date = getSessionDate(session);
    if (!date) return;

    const existing = grouped.get(date) || {
      userId: session.user_id,
      sessionCount: 0,
      totalMinutes: 0,
    };

    grouped.set(date, {
      userId: existing.userId,
      sessionCount: existing.sessionCount + 1,
      totalMinutes: existing.totalMinutes + Math.max(session.duration || 0, 0),
    });
  });

  return Array.from(grouped.entries()).map(([date, day]) => ({
    id: date,
    user_id: day.userId,
    activity_date: date,
    session_count: day.sessionCount,
    progress_log_count: 0,
    total_minutes: day.totalMinutes,
    used_freeze: false,
    created_at: `${date}T00:00:00.000Z`,
    updated_at: `${date}T00:00:00.000Z`,
  }));
};

const normalizeStreakDays = (days: ReadingStreakDay[]) => {
  const normalized = new Map<string, ReadingStreakDay>();

  days.forEach((day) => {
    const hasActivity =
      day.used_freeze || day.session_count > 0 || day.progress_log_count > 0;

    if (!hasActivity) return;

    const existing = normalized.get(day.activity_date);
    if (!existing) {
      normalized.set(day.activity_date, day);
      return;
    }

    normalized.set(day.activity_date, {
      ...existing,
      session_count: existing.session_count + day.session_count,
      progress_log_count: existing.progress_log_count + day.progress_log_count,
      total_minutes: existing.total_minutes + day.total_minutes,
      used_freeze: existing.used_freeze || day.used_freeze,
      updated_at: day.updated_at > existing.updated_at ? day.updated_at : existing.updated_at,
    });
  });

  return normalized;
};
