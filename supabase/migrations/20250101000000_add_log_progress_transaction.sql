-- Create a database function to handle progress logging in a transaction
-- This ensures atomicity of all operations

CREATE OR REPLACE FUNCTION public.log_progress_transaction(
  p_user_id UUID,
  p_book_id UUID,
  p_page_number INTEGER,
  p_chapter_number INTEGER DEFAULT NULL,
  p_paragraph_number INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_log_type TEXT DEFAULT 'manual',
  p_time_spent_minutes INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progress_log_id UUID;
  v_book_record RECORD;
  v_updates JSONB;
  v_total_time_minutes INTEGER;
  v_total_time_from_logs INTEGER;
  v_total_time_from_sessions INTEGER;
  v_total_hours NUMERIC;
  v_progress_percentage NUMERIC;
  v_pages_per_hour NUMERIC;
  v_result JSONB;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Insert progress log
  INSERT INTO public.progress_logs (
    user_id,
    book_id,
    page_number,
    chapter_number,
    paragraph_number,
    notes,
    log_type,
    time_spent_minutes
  )
  VALUES (
    p_user_id,
    p_book_id,
    p_page_number,
    p_chapter_number,
    p_paragraph_number,
    p_notes,
    p_log_type,
    p_time_spent_minutes
  )
  RETURNING id INTO v_progress_log_id;

  -- Get book details
  SELECT pages, current_page, status
  INTO v_book_record
  FROM public.books
  WHERE id = p_book_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found or access denied';
  END IF;

  -- Prepare updates
  v_updates := jsonb_build_object('current_page', p_page_number);
  
  -- Auto-complete book if page >= total pages
  IF v_book_record.pages IS NOT NULL AND p_page_number >= v_book_record.pages AND v_book_record.status != 'completed' THEN
    v_updates := v_updates || jsonb_build_object(
      'status', 'completed',
      'date_finished', CURRENT_DATE
    );
  END IF;

  -- Update book
  UPDATE public.books
  SET 
    current_page = (v_updates->>'current_page')::INTEGER,
    status = COALESCE((v_updates->>'status')::TEXT, status),
    date_finished = COALESCE((v_updates->>'date_finished')::DATE, date_finished),
    updated_at = NOW()
  WHERE id = p_book_id;

  -- Calculate statistics - get total time from both sources
  -- Fix: Calculate sums separately to avoid CROSS JOIN multiplication
  SELECT COALESCE(SUM(time_spent_minutes), 0)
  INTO v_total_time_from_logs
  FROM public.progress_logs
  WHERE book_id = p_book_id;

  SELECT COALESCE(SUM(duration), 0)
  INTO v_total_time_from_sessions
  FROM public.reading_sessions
  WHERE book_id = p_book_id;

  v_total_time_minutes := COALESCE(v_total_time_from_logs, 0) + COALESCE(v_total_time_from_sessions, 0);

  v_total_hours := v_total_time_minutes / 60.0;
  v_progress_percentage := CASE 
    WHEN v_book_record.pages IS NOT NULL AND v_book_record.pages > 0 
    THEN (p_page_number::NUMERIC / v_book_record.pages::NUMERIC) * 100
    ELSE 0
  END;
  v_pages_per_hour := CASE 
    WHEN v_total_hours > 0 THEN p_page_number::NUMERIC / v_total_hours
    ELSE 0
  END;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'log_id', v_progress_log_id,
    'progress', jsonb_build_object(
      'current_page', p_page_number,
      'total_pages', v_book_record.pages,
      'progress_percentage', ROUND(v_progress_percentage, 2),
      'pages_per_hour', ROUND(v_pages_per_hour, 2),
      'total_time_hours', ROUND(v_total_hours, 2),
      'status', COALESCE((v_updates->>'status')::TEXT, v_book_record.status)
    )
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic on exception
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.log_progress_transaction TO authenticated;
