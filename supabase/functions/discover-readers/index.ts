import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Get current user's reading preferences (genres)
    const { data: userBooks } = await supabaseClient
      .from('books')
      .select('genre')
      .eq('user_id', user.id)
      .not('genre', 'is', null);

    const userGenres = new Set(userBooks?.map(b => b.genre) || []);

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
      query = query.ilike('display_name', `%${searchQuery}%`);
    }

    const { data: profiles, error: profilesError } = await query.limit(100);

    if (profilesError) {
      throw profilesError;
    }

    // Calculate recommendations for each user
    const recommendations: ReaderRecommendation[] = await Promise.all(
      profiles.map(async (profile) => {
        let score = 0;
        let reason = '';
        const reasons: string[] = [];

        // 1. Geographic proximity (if both users have location)
        let distance_km: number | undefined;
        if (
          currentProfile?.latitude &&
          currentProfile?.longitude &&
          profile.latitude &&
          profile.longitude
        ) {
          const { data: distanceData } = await supabaseClient.rpc('calculate_distance', {
            lat1: currentProfile.latitude,
            lon1: currentProfile.longitude,
            lat2: profile.latitude,
            lon2: profile.longitude,
          });

          distance_km = distanceData;

          if (distance_km !== null && distance_km < (maxDistance || 50)) {
            const proximityScore = Math.max(0, 50 - distance_km);
            score += proximityScore;
            reasons.push(`${Math.round(distance_km)}km away`);
          }
        }

        // 2. Social graph - mutual follows (followers of people you follow)
        const { data: mutualData, count: mutualCount } = await supabaseClient
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', profile.id)
          .in('following_id', Array.from(followingIds));

        const mutual_follows = mutualCount || 0;
        if (mutual_follows > 0) {
          score += mutual_follows * 30;
          reasons.push(`${mutual_follows} mutual connection${mutual_follows > 1 ? 's' : ''}`);
        }

        // 3. Reading taste similarity (genre overlap)
        const { data: theirBooks } = await supabaseClient
          .from('books')
          .select('genre')
          .eq('user_id', profile.id)
          .not('genre', 'is', null);

        const theirGenres = new Set(theirBooks?.map(b => b.genre) || []);
        const commonGenres = [...userGenres].filter(g => theirGenres.has(g));
        const genre_overlap = commonGenres.length;

        if (genre_overlap > 0) {
          score += genre_overlap * 20;
          reasons.push(`${genre_overlap} similar genre${genre_overlap > 1 ? 's' : ''}`);
        }

        // 4. Activity level (recent reading sessions)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { count: sessionCount } = await supabaseClient
          .from('reading_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', thirtyDaysAgo.toISOString());

        const recent_activity = sessionCount || 0;
        if (recent_activity > 5) {
          score += Math.min(recent_activity * 2, 30);
          reasons.push('active reader');
        }

        // 5. Current streak bonus
        if (profile.current_streak > 7) {
          score += Math.min(profile.current_streak, 20);
          reasons.push(`${profile.current_streak} day streak`);
        }

        // Get books read count
        const { count: booksCount } = await supabaseClient
          .from('books')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'completed')
          .is('deleted_at', null);

        const books_read_count = booksCount || 0;

        reason = reasons.length > 0 ? reasons.join(', ') : 'New reader';

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
      })
    );

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
    console.error('Error in discover-readers:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
