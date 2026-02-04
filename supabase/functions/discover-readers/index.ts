import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ReaderRecommendation {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  current_streak: number;
  books_read_count: number;
  distance_km?: number;
  mutual_follows?: number;
  genre_overlap?: number;
  recent_activity?: number;
  recommendation_reason: string;
  recommendation_score: number;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { searchQuery, maxDistance } = await req.json();

    // Get current user's profile with location
    const { data: currentProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('latitude, longitude, id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
    }

    // Get current user's reading preferences from reading_habits (more efficient)
    const { data: userHabits } = await supabaseClient
      .from('reading_habits')
      .select('genres, longest_genre, avg_time_per_book, avg_length')
      .eq('user_id', user.id)
      .single();

    // Fallback to books if reading_habits not available
    let userGenres = new Set<string>();
    if (userHabits?.genres && userHabits.genres.length > 0) {
      userGenres = new Set(userHabits.genres);
    } else {
      const { data: userBooks } = await supabaseClient
        .from('books')
        .select('genre')
        .eq('user_id', user.id)
        .not('genre', 'is', null);
      userGenres = new Set(userBooks?.map(b => b.genre) || []);
    }

    // Get users the current user follows
    const { data: following } = await supabaseClient
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = new Set(following?.map(f => f.following_id) || []);

    // Get all public profiles except current user
    let query = supabaseClient
      .from('profiles')
      .select('id, display_name, avatar_url, bio, current_streak, latitude, longitude')
      .eq('profile_visibility', 'public')
      .neq('id', user.id);

    if (searchQuery) {
      // Validate search query length
      if (searchQuery.length > 200) {
        const { createErrorResponse } = await import("../_shared/errorHandler.ts");
        return createErrorResponse(
          new Error("Search query too long (max 200 characters)"),
          400,
          req.headers.get('origin'),
          { function: "discover-readers" }
        );
      }
      query = query.ilike('display_name', `%${searchQuery}%`);
    }

    const { data: profiles, error: profilesError } = await query.limit(100);

    if (profilesError) {
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({
          all: [],
          nearby: [],
          socialConnections: [],
          similarTaste: [],
          activeReaders: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const profileIds = profiles.map(p => p.id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Batch fetch all data in parallel
    const [
      { data: allBooks },
      { data: allReadingHabits },
      { data: allMutualFollows },
      { data: allSessions },
      { data: allCompletedBooks },
    ] = await Promise.all([
      // Fetch all books with genres for all profiles (fallback)
      supabaseClient
        .from('books')
        .select('user_id, genre')
        .in('user_id', profileIds)
        .not('genre', 'is', null),
      
      // Fetch reading habits for all profiles (more efficient for genre matching)
      supabaseClient
        .from('reading_habits')
        .select('user_id, genres, longest_genre, avg_time_per_book, avg_length')
        .in('user_id', profileIds),
      
      // Fetch all mutual follows in one query
      supabaseClient
        .from('user_follows')
        .select('follower_id, following_id')
        .in('follower_id', profileIds)
        .in('following_id', Array.from(followingIds)),
      
      // Fetch all recent reading sessions
      supabaseClient
        .from('reading_sessions')
        .select('user_id, created_at')
        .in('user_id', profileIds)
        .gte('created_at', thirtyDaysAgo.toISOString()),
      
      // Fetch all completed book counts
      supabaseClient
        .from('books')
        .select('user_id')
        .in('user_id', profileIds)
        .eq('status', 'completed')
        .is('deleted_at', null),
    ]);

    // Create lookup maps for efficient access
    // Prefer reading_habits.genres over books.genre for better performance
    const genresByUser = new Map<string, Set<string>>();
    const readingHabitsByUser = new Map<string, any>();
    
    allReadingHabits?.forEach(habit => {
      if (habit.user_id) {
        readingHabitsByUser.set(habit.user_id, habit);
        if (habit.genres && habit.genres.length > 0) {
          genresByUser.set(habit.user_id, new Set(habit.genres));
        }
      }
    });
    
    // Fallback to books for users without reading_habits
    allBooks?.forEach(book => {
      if (book.genre && book.user_id) {
        if (!genresByUser.has(book.user_id)) {
          genresByUser.set(book.user_id, new Set());
        }
        genresByUser.get(book.user_id)!.add(book.genre);
      }
    });

    const mutualFollowsByUser = new Map<string, number>();
    allMutualFollows?.forEach(follow => {
      if (follow.follower_id) {
        mutualFollowsByUser.set(
          follow.follower_id,
          (mutualFollowsByUser.get(follow.follower_id) || 0) + 1
        );
      }
    });

    const sessionsByUser = new Map<string, number>();
    allSessions?.forEach(session => {
      if (session.user_id) {
        sessionsByUser.set(
          session.user_id,
          (sessionsByUser.get(session.user_id) || 0) + 1
        );
      }
    });

    const completedBooksByUser = new Map<string, number>();
    allCompletedBooks?.forEach(book => {
      if (book.user_id) {
        completedBooksByUser.set(
          book.user_id,
          (completedBooksByUser.get(book.user_id) || 0) + 1
        );
      }
    });

    // Helper function to calculate distance (Haversine formula)
    const calculateDistance = (
      lat1: number, lon1: number, lat2: number, lon2: number
    ): number => {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Calculate recommendations for each user (now using pre-fetched data)
    const recommendations: ReaderRecommendation[] = profiles.map((profile) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Geographic proximity (calculate in memory)
      let distance_km: number | undefined;
      if (
        currentProfile?.latitude &&
        currentProfile?.longitude &&
        profile.latitude &&
        profile.longitude
      ) {
        distance_km = calculateDistance(
          currentProfile.latitude,
          currentProfile.longitude,
          profile.latitude,
          profile.longitude
        );

        if (distance_km < (maxDistance || 50)) {
          const proximityScore = Math.max(0, 50 - distance_km);
          score += proximityScore;
          reasons.push(`${Math.round(distance_km)}km away`);
        }
      }

      // 2. Social graph - mutual follows (from pre-fetched data)
      const mutual_follows = mutualFollowsByUser.get(profile.id) || 0;
      if (mutual_follows > 0) {
        score += mutual_follows * 30;
        reasons.push(`${mutual_follows} mutual connection${mutual_follows > 1 ? 's' : ''}`);
      }

      // 3. Reading taste similarity (from reading_habits or books)
      const theirGenres = genresByUser.get(profile.id) || new Set<string>();
      const commonGenres = [...userGenres].filter(g => theirGenres.has(g));
      const genre_overlap = commonGenres.length;

      if (genre_overlap > 0) {
        score += genre_overlap * 20;
        reasons.push(`${genre_overlap} similar genre${genre_overlap > 1 ? 's' : ''}`);
      }

      // 3b. Reading pace compatibility (from reading_habits)
      const theirHabits = readingHabitsByUser.get(profile.id);
      if (userHabits && theirHabits) {
        // Match users with similar reading pace (within 20% difference)
        if (userHabits.avg_time_per_book && theirHabits.avg_time_per_book) {
          const paceDiff = Math.abs(userHabits.avg_time_per_book - theirHabits.avg_time_per_book);
          const avgPace = (userHabits.avg_time_per_book + theirHabits.avg_time_per_book) / 2;
          if (paceDiff / avgPace < 0.2) {
            score += 10;
            reasons.push('similar reading pace');
          }
        }
        
        // Match users with same longest genre preference
        if (userHabits.longest_genre && theirHabits.longest_genre && 
            userHabits.longest_genre === theirHabits.longest_genre) {
          score += 15;
          reasons.push(`both love ${userHabits.longest_genre}`);
        }
      }

      // 4. Activity level (from pre-fetched data)
      const recent_activity = sessionsByUser.get(profile.id) || 0;
      if (recent_activity > 5) {
        score += Math.min(recent_activity * 2, 30);
        reasons.push('active reader');
      }

      // 5. Current streak bonus
      if (profile.current_streak > 7) {
        score += Math.min(profile.current_streak, 20);
        reasons.push(`${profile.current_streak} day streak`);
      }

      // Books read count (from pre-fetched data)
      const books_read_count = completedBooksByUser.get(profile.id) || 0;

      const reason = reasons.length > 0 ? reasons.join(', ') : 'New reader';

      return {
        id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        current_streak: profile.current_streak,
        books_read_count,
        distance_km,
        mutual_follows,
        genre_overlap,
        recent_activity,
        recommendation_reason: reason,
        recommendation_score: score,
      };
    });

    // Sort by recommendation score (highest first)
    recommendations.sort((a, b) => b.recommendation_score - a.recommendation_score);

    // Group into categories
    const nearby = recommendations.filter(r => r.distance_km !== undefined && r.distance_km < 25);
    const socialConnections = recommendations.filter(r => (r.mutual_follows || 0) > 0);
    const similarTaste = recommendations.filter(r => (r.genre_overlap || 0) >= 2);
    const activeReaders = recommendations.filter(r => (r.recent_activity || 0) > 10);

    return new Response(
      JSON.stringify({
        all: recommendations.slice(0, 50),
        nearby: nearby.slice(0, 10),
        socialConnections: socialConnections.slice(0, 10),
        similarTaste: similarTaste.slice(0, 10),
        activeReaders: activeReaders.slice(0, 10),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const { createErrorResponse } = await import("../_shared/errorHandler.ts");
    return createErrorResponse(error, 500, req.headers.get('origin'), {
      function: "discover-readers",
    });
  }
});
