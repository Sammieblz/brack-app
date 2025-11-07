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
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const activities: any[] = [];

    // Fetch books with recent updates
    const { data: books } = await supabaseClient
      .from('books')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(50);

    // Add book activities
    books?.forEach(book => {
      if (book.status === 'completed' && book.date_finished) {
        activities.push({
          id: `book-completed-${book.id}`,
          type: 'book_completed',
          description: `Completed "${book.title}"`,
          timestamp: book.date_finished,
          book: { id: book.id, title: book.title, author: book.author, cover_url: book.cover_url },
        });
      }
      if (book.date_started && book.status === 'reading') {
        activities.push({
          id: `book-started-${book.id}`,
          type: 'book_started',
          description: `Started reading "${book.title}"`,
          timestamp: book.date_started,
          book: { id: book.id, title: book.title, author: book.author, cover_url: book.cover_url },
        });
      }
    });

    // Fetch recent progress logs
    const { data: progressLogs } = await supabaseClient
      .from('progress_logs')
      .select('*, books(id, title, author, cover_url)')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(50);

    progressLogs?.forEach(log => {
      const book = (log as any).books;
      activities.push({
        id: `progress-${log.id}`,
        type: 'progress_logged',
        description: `Logged page ${log.page_number}${book ? ` in "${book.title}"` : ''}${log.notes ? ' with notes' : ''}`,
        timestamp: log.logged_at,
        book: book ? { id: book.id, title: book.title, author: book.author, cover_url: book.cover_url } : null,
        details: {
          page_number: log.page_number,
          paragraph_number: log.paragraph_number,
          notes: log.notes,
        },
      });
    });

    // Fetch recent reading sessions
    const { data: sessions } = await supabaseClient
      .from('reading_sessions')
      .select('*, books(id, title, author, cover_url)')
      .eq('user_id', user.id)
      .not('duration', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    sessions?.forEach(session => {
      const book = (session as any).books;
      const duration = Math.round((session.duration || 0) / 60);
      activities.push({
        id: `session-${session.id}`,
        type: 'reading_session',
        description: `Read ${book ? `"${book.title}"` : 'a book'} for ${duration} minutes`,
        timestamp: session.created_at,
        book: book ? { id: book.id, title: book.title, author: book.author, cover_url: book.cover_url } : null,
        details: {
          duration_minutes: duration,
        },
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Paginate
    const paginatedActivities = activities.slice(offset, offset + limit);

    return new Response(
      JSON.stringify({
        activities: paginatedActivities,
        total: activities.length,
        has_more: offset + limit < activities.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in enhanced-activity:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
