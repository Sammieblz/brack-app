import { useState } from "react";
import { createSocialActivityPost } from "@/services/api";
import { toast } from "sonner";

export const useCreatePost = () => {
  const [loading, setLoading] = useState(false);

  const createPost = async (content: string, bookId?: string) => {
    try {
      setLoading(true);

      await createSocialActivityPost(content, bookId);

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
