export interface ValidationError {
  field: string;
  message: string;
}

export const validateBookForm = (book: {
  title?: string;
  pages?: number | null;
  chapters?: number | null;
  current_page?: number | null;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!book.title || book.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required' });
  }

  if (book.pages !== null && book.pages !== undefined && book.pages < 1) {
    errors.push({ field: 'pages', message: 'Page count must be at least 1' });
  }

  if (book.chapters !== null && book.chapters !== undefined && book.chapters < 1) {
    errors.push({ field: 'chapters', message: 'Chapter count must be at least 1' });
  }

  if (book.current_page !== null && book.current_page !== undefined) {
    if (book.current_page < 0) {
      errors.push({ field: 'current_page', message: 'Current page cannot be negative' });
    }
    if (book.pages && book.current_page > book.pages) {
      errors.push({ field: 'current_page', message: 'Current page cannot exceed total pages' });
    }
  }

  return errors;
};
