import { getCorsHeaders } from "./cors.ts";

/**
 * Sanitize error messages to prevent information leakage
 * Only returns safe, user-friendly error messages
 */
const sanitizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for sensitive patterns that should not be exposed
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /credential/i,
      /sql/i,
      /database/i,
      /connection/i,
      /query/i,
      /syntax/i,
      /constraint/i,
      /violation/i,
    ];

    // If error contains sensitive information, return generic message
    if (sensitivePatterns.some(pattern => pattern.test(message))) {
      return "An error occurred processing your request. Please try again.";
    }

    // Return sanitized error message (limit length)
    return error.message.substring(0, 200);
  }

  return "An unexpected error occurred. Please try again.";
};

/**
 * Create a standardized error response
 */
export const createErrorResponse = (
  error: unknown,
  status: number = 500,
  origin: string | null = null,
  logDetails?: Record<string, unknown>
): Response => {
  // Log full error details server-side (for debugging)
  console.error("Error details:", {
    error,
    status,
    ...logDetails,
  });

  // Return sanitized error message to client
  const sanitizedMessage = sanitizeErrorMessage(error);
  const corsHeaders = getCorsHeaders(origin);

  return new Response(
    JSON.stringify({ 
      error: sanitizedMessage,
      // Include error ID for tracking (optional)
      errorId: logDetails?.requestId || undefined,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
};
