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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { book_id, page_number, paragraph_number, notes, log_type, time_spent_minutes } = await req.json();

    if (!book_id || !page_number || !log_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert progress log
    const { data: progressLog, error: logError } = await supabaseClient
      .from('progress_logs')
      .insert({
        user_id: user.id,
        book_id,
        page_number,
        paragraph_number,
        notes,
        log_type,
        time_spent_minutes,
      })
      .select()
      .single();

    if (logError) throw logError;

    // Update book's current_page
    const { data: book, error: bookError } = await supabaseClient
      .from('books')
      .select('pages, current_page, status')
      .eq('id', book_id)
      .single();

    if (bookError) throw bookError;

    // Update book with new progress
    const updates: any = { current_page: page_number };
    
    // Auto-complete book if page >= total pages
    if (book.pages && page_number >= book.pages && book.status !== 'completed') {
      updates.status = 'completed';
      updates.date_finished = new Date().toISOString().split('T')[0];
    }

    const { error: updateError } = await supabaseClient
      .from('books')
      .update(updates)
      .eq('id', book_id);

    if (updateError) throw updateError;

    // Calculate updated progress statistics
    const { data: allLogs } = await supabaseClient
      .from('progress_logs')
      .select('page_number, time_spent_minutes, logged_at')
      .eq('book_id', book_id)
      .order('logged_at', { ascending: false });

    const { data: sessions } = await supabaseClient
      .from('reading_sessions')
      .select('duration')
      .eq('book_id', book_id);

    const totalTimeFromSessions = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const totalTimeFromLogs = allLogs?.reduce((sum, l) => sum + (l.time_spent_minutes || 0), 0) || 0;
    const totalMinutes = totalTimeFromSessions + totalTimeFromLogs;
    const totalHours = totalMinutes / 60;

    const progressPercentage = book.pages ? (page_number / book.pages) * 100 : 0;
    const pagesPerHour = totalHours > 0 ? page_number / totalHours : 0;

    return new Response(
      JSON.stringify({
        success: true,
        log: progressLog,
        progress: {
          current_page: page_number,
          total_pages: book.pages,
          progress_percentage: progressPercentage,
          pages_per_hour: pagesPerHour,
          total_time_hours: totalHours,
          status: updates.status || book.status,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in log-progress:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
