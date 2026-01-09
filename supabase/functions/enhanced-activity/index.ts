import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify the JWT token from the Authorization header
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    
    if (userError || !user) {
      const { createErrorResponse } = await import("../_shared/errorHandler.ts");
      return createErrorResponse(userError || new Error('Unauthorized'), 401, req.headers.get('origin'), {
        function: "enhanced-activity",
      });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Fetch more items per type to account for filtering, but use database-level sorting
    // We'll fetch limit * 3 per type to ensure we have enough after filtering
    const fetchLimit = Math.max(limit * 3, 30);

    // Fetch all activity types in parallel with database-level sorting
    const [
      { data: completedBooks },
      { data: startedBooks },
      { data: progressLogs },
      { data: sessions },
    ] = await Promise.all([
      // Completed books - ordered by date_finished
      supabaseClient
        .from('books')
        .select('id, title, author, cover_url, date_finished')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .not('date_finished', 'is', null)
        .is('deleted_at', null)
        .order('date_finished', { ascending: false })
        .limit(fetchLimit),
      
      // Started books - ordered by date_started
      supabaseClient
        .from('books')
        .select('id, title, author, cover_url, date_started')
        .eq('user_id', user.id)
        .eq('status', 'reading')
        .not('date_started', 'is', null)
        .is('deleted_at', null)
        .order('date_started', { ascending: false })
        .limit(fetchLimit),
      
      // Progress logs - ordered by logged_at
      supabaseClient
        .from('progress_logs')
        .select('id, page_number, paragraph_number, notes, logged_at, book_id, books(id, title, author, cover_url)')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(fetchLimit),
      
      // Reading sessions - ordered by created_at
      supabaseClient
        .from('reading_sessions')
        .select('id, duration, created_at, book_id, books(id, title, author, cover_url)')
        .eq('user_id', user.id)
        .not('duration', 'is', null)
        .order('created_at', { ascending: false })
        .limit(fetchLimit),
    ]);

    // Transform to activities array
    const activities: any[] = [];

    // Add completed book activities
    completedBooks?.forEach(book => {
      activities.push({
        id: `book-completed-${book.id}`,
        type: 'book_completed',
        description: `Completed "${book.title}"`,
        timestamp: book.date_finished,
        book: { id: book.id, title: book.title, author: book.author, cover_url: book.cover_url },
      });
    });

    // Add started book activities
    startedBooks?.forEach(book => {
      activities.push({
        id: `book-started-${book.id}`,
        type: 'book_started',
        description: `Started reading "${book.title}"`,
        timestamp: book.date_started,
        book: { id: book.id, title: book.title, author: book.author, cover_url: book.cover_url },
      });
    });

    // Add progress log activities
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

    // Add reading session activities
    sessions?.forEach(session => {
      const book = (session as any).books;
      const duration = session.duration || 0;
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

    // Sort all activities by timestamp (merge sort would be more efficient, but this is simpler)
    // Since we fetched sorted data, we can use a more efficient merge
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Paginate
    const total = activities.length;
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
    const { createErrorResponse } = await import("../_shared/errorHandler.ts");
    return createErrorResponse(error, 500, req.headers.get('origin'), {
      function: "enhanced-activity",
      userId: user?.id,
    });
  }
});
