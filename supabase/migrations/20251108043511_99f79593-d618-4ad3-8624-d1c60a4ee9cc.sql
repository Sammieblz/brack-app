-- Fix search_path for calculate_distance function to address security warning
CREATE OR REPLACE FUNCTION calculate_distance(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  radius double precision := 6371; -- Earth's radius in km
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN radius * c;
END;
$$;