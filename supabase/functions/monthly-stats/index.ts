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
    const monthsBack = parseInt(url.searchParams.get('months') || '12');

    // Calculate start date
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // Fetch all books and sessions since start date
    const { data: books } = await supabaseClient
      .from('books')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .is('deleted_at', null);

    const { data: sessions } = await supabaseClient
      .from('reading_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString());

    // Group by month
    const monthlyData = new Map<string, any>();

    // Initialize months
    for (let i = 0; i < monthsBack; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(monthKey, {
        month: monthKey,
        books_completed: 0,
        total_pages: 0,
        total_reading_minutes: 0,
        avg_daily_minutes: 0,
        most_read_genre: null,
      });
    }

    // Process completed books
    books?.forEach(book => {
      if (book.status === 'completed' && book.date_finished) {
        const date = new Date(book.date_finished);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (monthlyData.has(monthKey)) {
          const data = monthlyData.get(monthKey);
          data.books_completed += 1;
          data.total_pages += book.pages || 0;
        }
      }
    });

    // Process reading sessions
    sessions?.forEach(session => {
      const date = new Date(session.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData.has(monthKey)) {
        const data = monthlyData.get(monthKey);
        data.total_reading_minutes += session.duration || 0;
      }
    });

    // Calculate averages and most read genre
    for (const [monthKey, data] of monthlyData.entries()) {
      const [year, month] = monthKey.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      data.avg_daily_minutes = data.total_reading_minutes / daysInMonth;

      // Find most read genre for this month
      const monthBooks = books?.filter(book => {
        if (!book.date_finished) return false;
        const date = new Date(book.date_finished);
        const bookMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return bookMonthKey === monthKey && book.status === 'completed';
      });

      if (monthBooks && monthBooks.length > 0) {
        const genreCounts = new Map<string, number>();
        monthBooks.forEach(book => {
          if (book.genre) {
            genreCounts.set(book.genre, (genreCounts.get(book.genre) || 0) + 1);
          }
        });
        
        let maxCount = 0;
        let topGenre = null;
        for (const [genre, count] of genreCounts.entries()) {
          if (count > maxCount) {
            maxCount = count;
            topGenre = genre;
          }
        }
        data.most_read_genre = topGenre;
      }
    }

    const result = Array.from(monthlyData.values())
      .sort((a, b) => a.month.localeCompare(b.month));

    return new Response(
      JSON.stringify({ months: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in monthly-stats:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
