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
        function: "log-progress",
      });
    }

    const { book_id, page_number, chapter_number, paragraph_number, notes, log_type, time_spent_minutes } = await req.json();

    if (!book_id || !page_number || !log_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use database function with transaction support for atomic operations
    const { data: result, error: rpcError } = await supabaseClient.rpc(
      'log_progress_transaction',
      {
        p_user_id: user.id,
        p_book_id: book_id,
        p_page_number: page_number,
        p_chapter_number: chapter_number || null,
        p_paragraph_number: paragraph_number || null,
        p_notes: notes || null,
        p_log_type: log_type,
        p_time_spent_minutes: time_spent_minutes || null,
      }
    );

    if (rpcError) throw rpcError;

    // Fetch the created log for response
    const { data: progressLog } = await supabaseClient
      .from('progress_logs')
      .select('*')
      .eq('id', result.log_id)
      .single();

    return new Response(
      JSON.stringify({
        success: result.success,
        log: progressLog,
        progress: result.progress,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const { createErrorResponse } = await import("../_shared/errorHandler.ts");
    return createErrorResponse(error, 500, req.headers.get('origin'), {
      function: "log-progress",
      userId: user?.id,
    });
  }
});
