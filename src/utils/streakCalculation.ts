import type { ReadingSession, Profile } from "@/types";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastReadingDate: string | null;
  canUseFreezeToday: boolean;
  freezeAvailable: boolean;
}

export interface DayActivity {
  date: string;
  hasActivity: boolean;
  sessionCount: number;
  totalMinutes: number;
}

/**
 * Calculate streak information from reading sessions
 */
export const calculateStreakFromSessions = (
  sessions: ReadingSession[],
  profile: Profile | null
): StreakData => {
  if (!sessions || sessions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastReadingDate: null,
      canUseFreezeToday: false,
      freezeAvailable: true,
    };
  }

  // Group sessions by date
  const sessionsByDate = new Map<string, ReadingSession[]>();
  sessions.forEach((session) => {
    const date = new Date(session.created_at).toISOString().split("T")[0];
    if (!sessionsByDate.has(date)) {
      sessionsByDate.set(date, []);
    }
    sessionsByDate.get(date)!.push(session);
  });

  // Get sorted unique dates
  const uniqueDates = Array.from(sessionsByDate.keys()).sort();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = new Date();
  
  // Check if there's activity today or yesterday (grace period)
  const hasActivityToday = sessionsByDate.has(today);
  const hasActivityYesterday = sessionsByDate.has(yesterday);
  
  if (hasActivityToday) {
    currentStreak = 1;
    checkDate = new Date(today);
  } else if (hasActivityYesterday) {
    currentStreak = 1;
    checkDate = new Date(yesterday);
  } else {
    // Streak broken
    return {
      currentStreak: 0,
      longestStreak: profile?.longest_streak || 0,
      lastReadingDate: uniqueDates[uniqueDates.length - 1] || null,
      canUseFreezeToday: false,
      freezeAvailable: canUseStreakFreeze(profile),
    };
  }

  // Count backwards to find streak length
  while (true) {
    checkDate.setDate(checkDate.getDate() - 1);
    const checkDateStr = checkDate.toISOString().split("T")[0];
    
    if (sessionsByDate.has(checkDateStr)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest streak from all sessions
  let longestStreak = currentStreak;
  let tempStreak = 0;
  
  for (let i = 0; i < uniqueDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / 86400000);
      
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Update longest streak if current is higher
  longestStreak = Math.max(longestStreak, profile?.longest_streak || 0);

  return {
    currentStreak,
    longestStreak,
    lastReadingDate: uniqueDates[uniqueDates.length - 1] || null,
    canUseFreezeToday: !hasActivityToday && hasActivityYesterday,
    freezeAvailable: canUseStreakFreeze(profile),
  };
};

/**
 * Check if user can use streak freeze (once per week)
 */
export const canUseStreakFreeze = (profile: Profile | null): boolean => {
  if (!profile || !profile.streak_freeze_used_at) return true;
  
  const lastUsed = new Date(profile.streak_freeze_used_at);
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  
  return lastUsed < weekAgo;
};

/**
 * Get activity calendar data for the last N days
 */
export const getActivityCalendar = (
  sessions: ReadingSession[],
  days: number = 90
): DayActivity[] => {
  const result: DayActivity[] = [];
  const sessionsByDate = new Map<string, ReadingSession[]>();
  
  // Group sessions by date
  sessions.forEach((session) => {
    const date = new Date(session.created_at).toISOString().split("T")[0];
    if (!sessionsByDate.has(date)) {
      sessionsByDate.set(date, []);
    }
    sessionsByDate.get(date)!.push(session);
  });

  // Generate calendar data
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    
    const daySessions = sessionsByDate.get(dateStr) || [];
    const totalMinutes = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    
    result.push({
      date: dateStr,
      hasActivity: daySessions.length > 0,
      sessionCount: daySessions.length,
      totalMinutes,
    });
  }

  return result;
};

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
