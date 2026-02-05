import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useCreatePost = () => {
  const [loading, setLoading] = useState(false);

  const createPost = async (content: string, bookId?: string) => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("social_activities")
        .insert({
          user_id: user.id,
          activity_type: "post",
          book_id: bookId || null,
          metadata: { content },
          visibility: "public",
        });

      if (error) throw error;

      toast.success("Post created successfully!");
      return true;
    } catch (error: unknown) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { createPost, loading };
};
