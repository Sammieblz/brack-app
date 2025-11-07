import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const url = new URL(req.url);
    const book_id = url.searchParams.get('book_id');

    if (!book_id) {
      return new Response(JSON.stringify({ error: 'Missing book_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch book details
    const { data: book, error: bookError } = await supabaseClient
      .from('books')
      .select('*')
      .eq('id', book_id)
      .eq('user_id', user.id)
      .single();

    if (bookError) throw bookError;

    // Fetch all progress logs
    const { data: logs } = await supabaseClient
      .from('progress_logs')
      .select('*')
      .eq('book_id', book_id)
      .order('logged_at', { ascending: false });

    // Fetch all reading sessions
    const { data: sessions } = await supabaseClient
      .from('reading_sessions')
      .select('*')
      .eq('book_id', book_id)
      .order('created_at', { ascending: false });

    // Calculate statistics
    const currentPage = logs && logs.length > 0 ? Math.max(...logs.map(l => l.page_number)) : book.current_page || 0;
    
    const totalTimeFromSessions = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const totalTimeFromLogs = logs?.reduce((sum, l) => sum + (l.time_spent_minutes || 0), 0) || 0;
    const totalMinutes = totalTimeFromSessions + totalTimeFromLogs;
    const totalHours = totalMinutes / 60;

    const progressPercentage = book.pages ? (currentPage / book.pages) * 100 : 0;
    const pagesPerHour = totalHours > 0 && currentPage > 0 ? currentPage / totalHours : 0;

    // Calculate recent velocity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentLogs = logs?.filter(l => new Date(l.logged_at) >= sevenDaysAgo) || [];
    const recentSessions = sessions?.filter(s => new Date(s.created_at) >= sevenDaysAgo) || [];
    
    const recentTimeMinutes = 
      recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0) +
      recentLogs.reduce((sum, l) => sum + (l.time_spent_minutes || 0), 0);
    const recentTimeHours = recentTimeMinutes / 60;
    
    const recentStartPage = recentLogs.length > 0 ? Math.min(...recentLogs.map(l => l.page_number)) : currentPage;
    const recentPagesRead = currentPage - recentStartPage;
    const recentPagesPerHour = recentTimeHours > 0 ? recentPagesRead / recentTimeHours : pagesPerHour;

    // Estimate completion
    let estimatedDaysToCompletion = null;
    if (book.pages && currentPage < book.pages && recentPagesPerHour > 0) {
      const remainingPages = book.pages - currentPage;
      const hoursNeeded = remainingPages / recentPagesPerHour;
      
      // Estimate based on recent reading frequency
      const avgHoursPerDay = recentSessions.length > 0 ? recentTimeHours / 7 : totalHours / Math.max(1, sessions?.length || 1);
      estimatedDaysToCompletion = Math.ceil(hoursNeeded / Math.max(0.5, avgHoursPerDay));
    }

    const estimatedCompletionDate = estimatedDaysToCompletion
      ? new Date(Date.now() + estimatedDaysToCompletion * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Calculate session statistics
    const avgSessionDuration = sessions && sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length
      : 0;
    
    const longestSession = sessions && sessions.length > 0
      ? Math.max(...sessions.map(s => s.duration || 0))
      : 0;

    const lastLoggedAt = logs && logs.length > 0 ? logs[0].logged_at : null;

    return new Response(
      JSON.stringify({
        current_page: currentPage,
        total_pages: book.pages,
        progress_percentage: Math.min(progressPercentage, 100),
        pages_per_hour: pagesPerHour,
        estimated_days_to_completion: estimatedDaysToCompletion,
        estimated_completion_date: estimatedCompletionDate,
        total_time_hours: totalHours,
        reading_velocity: {
          recent: recentPagesPerHour,
          overall: pagesPerHour,
        },
        statistics: {
          total_logs: logs?.length || 0,
          total_sessions: sessions?.length || 0,
          avg_session_duration: Math.round(avgSessionDuration),
          longest_session: Math.round(longestSession),
          last_logged_at: lastLoggedAt,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in calculate-book-progress:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
