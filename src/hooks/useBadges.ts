import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Badge, UserBadge, Book, ReadingSession } from "@/types";

export const BADGE_RULES = {
  'first-book': {
    title: 'First Book',
    check: (books: Book[]) => books.length >= 1
  },
  '10-books': {
    title: 'Bookworm',
    check: (books: Book[]) => books.filter(b => b.status === 'completed').length >= 10
  },
  '100-books': {
    title: 'Century Reader',
    check: (books: Book[]) => books.filter(b => b.status === 'completed').length >= 100
  },
  'marathon-reader': {
    title: 'Marathon Reader',
    check: (books: Book[]) => books.some(b => b.pages && b.pages >= 500 && b.status === 'completed')
  },
  'genre-explorer': {
    title: 'Genre Explorer',
    check: (books: Book[]) => {
      const genres = new Set(books.filter(b => b.genre).map(b => b.genre));
      return genres.size >= 5;
    }
  }
};

export const useBadges = (userId?: string) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchBadges();
    }
  }, [userId]);

  const fetchBadges = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      
      const [allBadgesRes, earnedBadgesRes] = await Promise.all([
        supabase.from('badges').select('*'),
        supabase.from('user_badges').select('*').eq('user_id', userId)
      ]);

      if (allBadgesRes.error) throw allBadgesRes.error;
      if (earnedBadgesRes.error) throw earnedBadgesRes.error;

      setBadges(allBadgesRes.data || []);
      setEarnedBadges(earnedBadgesRes.data || []);
    } catch (error: any) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndAwardBadges = async (books: Book[], sessions: ReadingSession[]) => {
    if (!userId) return;

    const earnedBadgeIds = new Set(earnedBadges.map(eb => eb.badge_id));
    const newBadges: Badge[] = [];

    // Check each badge rule
    for (const badge of badges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      const ruleKey = Object.keys(BADGE_RULES).find(
        key => BADGE_RULES[key as keyof typeof BADGE_RULES].title === badge.title
      );

      if (ruleKey) {
        const rule = BADGE_RULES[ruleKey as keyof typeof BADGE_RULES];
        if (rule.check(books)) {
          // Award this badge
          const { error } = await supabase
            .from('user_badges')
            .insert({ user_id: userId, badge_id: badge.id });

          if (!error) {
            newBadges.push(badge);
          }
        }
      }
    }

    // Show toast for newly earned badges
    if (newBadges.length > 0) {
      await fetchBadges(); // Refresh earned badges
      
      for (const badge of newBadges) {
        toast({
          title: "🎉 New Badge Earned!",
          description: `${badge.icon_url} ${badge.title}: ${badge.description}`,
        });
      }
    }
  };

  return {
    badges,
    earnedBadges,
    loading,
    refetchBadges: fetchBadges,
    checkAndAwardBadges
  };
};
