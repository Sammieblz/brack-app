import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - The potentially unsafe HTML string
 * @returns Sanitized HTML string safe for rendering
 */
export const sanitizeHtml = (dirty: string | null | undefined): string => {
  if (!dirty) return '';
  
  // Configure DOMPurify to be strict - only allow text content
  // This prevents any HTML/script injection
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // No HTML tags allowed - plain text only
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content but strip all tags
  });
};

/**
 * Sanitize plain text (removes any HTML tags)
 * @param text - The text to sanitize
 * @returns Plain text with HTML tags removed
 */
export const sanitizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  
  // Remove all HTML tags and decode entities
  const div = typeof document !== 'undefined' 
    ? document.createElement('div')
    : null;
  
  if (div) {
    div.textContent = text;
    return div.textContent || '';
  }
  
  // Fallback for server-side: basic tag removal
  return text.replace(/<[^>]*>/g, '').trim();
};

/**
 * Sanitize user input before saving to database
 * Strips all HTML and returns plain text
 */
export const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return '';
  return sanitizeText(input).trim();
};
