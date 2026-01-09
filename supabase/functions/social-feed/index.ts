import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { getCorsHeaders } from '../_shared/cors.ts';

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

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { limit = 20, offset = 0 } = await req.json();

    console.log('Fetching social feed for user:', user.id, { limit, offset });

    // Get users that the current user is following
    const { data: following, error: followError } = await supabaseClient
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id);

    if (followError) {
      console.error('Error fetching following:', followError);
      throw followError;
    }

    const followingIds = following?.map(f => f.following_id) || [];
    console.log('Following users:', followingIds.length);

    // Include user's own activities
    const userIds = [...followingIds, user.id];

    // Fetch activities from followed users and self
    const { data: activities, error: activitiesError } = await supabaseClient
      .from('social_activities')
      .select(`
        id,
        user_id,
        activity_type,
        book_id,
        review_id,
        list_id,
        badge_id,
        metadata,
        visibility,
        created_at
      `)
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      throw activitiesError;
    }

    console.log('Fetched activities:', activities?.length || 0);

    // Enrich activities with user profiles
    const userProfileIds = [...new Set(activities?.map(a => a.user_id) || [])];
    
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userProfileIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Enrich activities with book details where applicable
    const bookIds = [...new Set(
      activities
        ?.filter(a => a.book_id)
        .map(a => a.book_id as string) || []
    )];

    const { data: books, error: booksError } = await supabaseClient
      .from('books')
      .select('id, title, author, cover_url')
      .in('id', bookIds);

    if (booksError) {
      console.error('Error fetching books:', booksError);
    }

    // Create lookup maps
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const bookMap = new Map(books?.map(b => [b.id, b]) || []);

    // Enrich activities
    const enrichedActivities = activities?.map(activity => ({
      ...activity,
      user: profileMap.get(activity.user_id),
      book: activity.book_id ? bookMap.get(activity.book_id) : null,
    })) || [];

    const hasMore = activities?.length === limit;

    console.log('Returning enriched activities:', enrichedActivities.length);

    return new Response(
      JSON.stringify({ 
        activities: enrichedActivities,
        has_more: hasMore 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const { createErrorResponse } = await import("../_shared/errorHandler.ts");
    return createErrorResponse(error, 500, req.headers.get('origin'), {
      function: "social-feed",
    });
  }
});
