-- Create book_lists table for custom lists
CREATE TABLE public.book_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_public BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.book_lists ENABLE ROW LEVEL SECURITY;

-- Create policies for book_lists
CREATE POLICY "Users can manage their own lists"
ON public.book_lists
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create book_list_items table for list membership
CREATE TABLE public.book_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.book_lists(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(list_id, book_id)
);

-- Enable RLS
ALTER TABLE public.book_list_items ENABLE ROW LEVEL SECURITY;

-- Create policies for book_list_items
CREATE POLICY "Users can manage items in their own lists"
ON public.book_list_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.book_lists
    WHERE book_lists.id = book_list_items.list_id
    AND book_lists.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.book_lists
    WHERE book_lists.id = book_list_items.list_id
    AND book_lists.user_id = auth.uid()
  )
);

-- Add trigger for updated_at on book_lists
CREATE TRIGGER update_book_lists_updated_at
BEFORE UPDATE ON public.book_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enhance goals table with more columns
ALTER TABLE public.goals
ADD COLUMN goal_type TEXT DEFAULT 'books_count' CHECK (goal_type IN ('books_count', 'pages_count', 'reading_time')),
ADD COLUMN period_type TEXT DEFAULT 'yearly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly', 'custom')),
ADD COLUMN is_active BOOLEAN DEFAULT true,
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN target_pages INTEGER,
ADD COLUMN target_minutes INTEGER,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger for updated_at on goals
CREATE TRIGGER update_goals_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_book_list_items_list_id ON public.book_list_items(list_id);
CREATE INDEX idx_book_list_items_book_id ON public.book_list_items(book_id);
CREATE INDEX idx_goals_user_active ON public.goals(user_id, is_active);
CREATE INDEX idx_goals_period ON public.goals(period_type, start_date, end_date);