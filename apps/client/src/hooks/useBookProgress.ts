import { useState, useEffect } from "react";
import { getBookProgress, type BookProgressResponse } from "@/services/api";

export const useBookProgress = (bookId?: string) => {
  const [progress, setProgress] = useState<BookProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = async () => {
    if (!bookId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getBookProgress(bookId);
      setProgress(data);
    } catch (error) {
      console.error('Error fetching book progress:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [bookId]);

  return {
    progress,
    loading,
    refetchProgress: fetchProgress,
  };
};
