-- Guard against stale or impossible timer sessions being saved from persisted
-- clients, offline outbox replay, or direct RPC/table access.
CREATE OR REPLACE FUNCTION public.validate_reading_session_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_max_duration_minutes CONSTANT INTEGER := 720;
  v_wall_clock_minutes INTEGER;
BEGIN
  IF NEW.start_time IS NULL
    OR NEW.end_time IS NULL
    OR NEW.duration IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.duration < 1 THEN
    RAISE EXCEPTION 'Reading session duration must be at least one minute';
  END IF;

  IF NEW.duration > v_max_duration_minutes THEN
    RAISE EXCEPTION 'Reading sessions cannot exceed % hours', v_max_duration_minutes / 60;
  END IF;

  IF NEW.end_time < NEW.start_time THEN
    RAISE EXCEPTION 'Reading session end time cannot be before start time';
  END IF;

  IF NEW.end_time > now() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Reading session end time cannot be in the future';
  END IF;

  v_wall_clock_minutes := GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60.0)::INTEGER
  );

  IF NEW.duration > v_wall_clock_minutes + 2 THEN
    RAISE EXCEPTION 'Reading session duration does not match its time range';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_reading_session_row ON public.reading_sessions;
CREATE TRIGGER validate_reading_session_row
BEFORE INSERT OR UPDATE OF start_time, end_time, duration
ON public.reading_sessions
FOR EACH ROW
EXECUTE FUNCTION public.validate_reading_session_row();

REVOKE ALL ON FUNCTION public.validate_reading_session_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_reading_session_row() TO service_role;
