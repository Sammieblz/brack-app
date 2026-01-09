/**
 * Get CORS headers based on the request origin
 * Allows origins from environment variable ALLOWED_ORIGINS (comma-separated)
 * Falls back to wildcard in development if not set
 */
export const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
  
  let allowedOrigin = '*';
  
  if (allowedOrigins) {
    const origins = allowedOrigins.split(',').map(o => o.trim());
    if (origin && origins.includes(origin)) {
      allowedOrigin = origin;
    } else if (isDevelopment) {
      // In development, allow localhost origins
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        allowedOrigin = origin;
      }
    } else {
      // In production, reject if origin not in allowed list
      allowedOrigin = origins[0] || '*';
    }
  } else if (isDevelopment && origin) {
    // Development fallback: allow localhost
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      allowedOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};

// Legacy export for backward compatibility (will be deprecated)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
