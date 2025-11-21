-- Add foreign key constraints to posts table
ALTER TABLE public.posts
  ADD CONSTRAINT posts_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_book_id_fkey 
  FOREIGN KEY (book_id) 
  REFERENCES public.books(id) 
  ON DELETE SET NULL;