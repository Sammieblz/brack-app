-- Create book_clubs table
CREATE TABLE public.book_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  current_book_id UUID,
  cover_image_url TEXT,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create book_club_members table
CREATE TABLE public.book_club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);

-- Create book_club_discussions table
CREATE TABLE public.book_club_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.book_club_discussions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_book_club_members_club_id ON public.book_club_members(club_id);
CREATE INDEX idx_book_club_members_user_id ON public.book_club_members(user_id);
CREATE INDEX idx_book_club_discussions_club_id ON public.book_club_discussions(club_id);
CREATE INDEX idx_book_club_discussions_parent_id ON public.book_club_discussions(parent_id);

-- Create security definer function to check club membership
CREATE OR REPLACE FUNCTION public.is_club_member(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.book_club_members
    WHERE book_club_members.club_id = is_club_member.club_id
      AND book_club_members.user_id = is_club_member.user_id
  );
$$;

-- Create security definer function to check club admin role
CREATE OR REPLACE FUNCTION public.is_club_admin(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.book_club_members
    WHERE book_club_members.club_id = is_club_admin.club_id
      AND book_club_members.user_id = is_club_admin.user_id
      AND book_club_members.role = 'admin'
  );
$$;

-- Enable RLS
ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_discussions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for book_clubs
CREATE POLICY "Public clubs are viewable by everyone"
ON public.book_clubs FOR SELECT
USING (is_private = false OR auth.uid() = created_by OR public.is_club_member(id, auth.uid()));

CREATE POLICY "Users can create clubs"
ON public.book_clubs FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Club admins can update clubs"
ON public.book_clubs FOR UPDATE
USING (public.is_club_admin(id, auth.uid()));

CREATE POLICY "Club admins can delete clubs"
ON public.book_clubs FOR DELETE
USING (public.is_club_admin(id, auth.uid()));

-- RLS Policies for book_club_members
CREATE POLICY "Club members are viewable by club members"
ON public.book_club_members FOR SELECT
USING (public.is_club_member(club_id, auth.uid()));

CREATE POLICY "Club admins can add members"
ON public.book_club_members FOR INSERT
WITH CHECK (public.is_club_admin(club_id, auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Club admins can update member roles"
ON public.book_club_members FOR UPDATE
USING (public.is_club_admin(club_id, auth.uid()));

CREATE POLICY "Users can leave clubs and admins can remove members"
ON public.book_club_members FOR DELETE
USING (auth.uid() = user_id OR public.is_club_admin(club_id, auth.uid()));

-- RLS Policies for book_club_discussions
CREATE POLICY "Club members can view discussions"
ON public.book_club_discussions FOR SELECT
USING (public.is_club_member(club_id, auth.uid()));

CREATE POLICY "Club members can create discussions"
ON public.book_club_discussions FOR INSERT
WITH CHECK (public.is_club_member(club_id, auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Users can update their own discussions"
ON public.book_club_discussions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discussions"
ON public.book_club_discussions FOR DELETE
USING (auth.uid() = user_id OR public.is_club_admin(club_id, auth.uid()));

-- Create trigger for updated_at on book_clubs
CREATE TRIGGER update_book_clubs_updated_at
BEFORE UPDATE ON public.book_clubs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on book_club_discussions
CREATE TRIGGER update_book_club_discussions_updated_at
BEFORE UPDATE ON public.book_club_discussions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-add creator as admin member when club is created
CREATE OR REPLACE FUNCTION public.add_club_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.book_club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER add_creator_as_admin
AFTER INSERT ON public.book_clubs
FOR EACH ROW
EXECUTE FUNCTION public.add_club_creator_as_admin();