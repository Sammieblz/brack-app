-- Add foreign key constraint for journal_entries to books
ALTER TABLE public.journal_entries
ADD CONSTRAINT journal_entries_book_id_fkey 
FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;