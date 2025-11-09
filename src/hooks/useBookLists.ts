import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 15;

export interface BookList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  book_count?: number;
}

export interface BookListItem {
  id: string;
  list_id: string;
  book_id: string;
  position: number;
  added_at: string;
}

export const useBookLists = (userId?: string) => {
  const [lists, setLists] = useState<BookList[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchLists = async (isInitial = true) => {
    if (!userId) return;
    
    try {
      if (isInitial) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = isInitial ? 0 : offset;
      
      const { data, error } = await supabase
        .from('book_lists')
        .select(`
          *,
          book_list_items(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1);
      
      if (error) throw error;
      
      const listsWithCount = data?.map(list => ({
        ...list,
        book_count: list.book_list_items?.[0]?.count || 0
      })) || [];
      
      setHasMore(listsWithCount.length === PAGE_SIZE);
      
      if (isInitial) {
        setLists(listsWithCount);
        setOffset(PAGE_SIZE);
      } else {
        setLists(prev => [...prev, ...listsWithCount]);
        setOffset(prev => prev + PAGE_SIZE);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchLists(true);
  }, [userId]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchLists(false);
    }
  }, [loadingMore, hasMore, offset]);

  const createList = async (name: string, description?: string) => {
    if (!userId) return null;
    
    try {
      const { data, error } = await supabase
        .from('book_lists')
        .insert({ user_id: userId, name, description })
        .select()
        .single();
      
      if (error) throw error;
      await fetchLists(true);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  const updateList = async (listId: string, updates: Partial<BookList>) => {
    try {
      const { error } = await supabase
        .from('book_lists')
        .update(updates)
        .eq('id', listId);
      
      if (error) throw error;
      await fetchLists(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteList = async (listId: string) => {
    try {
      const { error } = await supabase
        .from('book_lists')
        .delete()
        .eq('id', listId);
      
      if (error) throw error;
      await fetchLists(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addBookToList = async (listId: string, bookId: string) => {
    try {
      // Get current max position
      const { data: items } = await supabase
        .from('book_list_items')
        .select('position')
        .eq('list_id', listId)
        .order('position', { ascending: false })
        .limit(1);
      
      const maxPosition = items?.[0]?.position || 0;
      
      const { error } = await supabase
        .from('book_list_items')
        .insert({ list_id: listId, book_id: bookId, position: maxPosition + 1 });
      
      if (error) throw error;
      await fetchLists(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeBookFromList = async (listId: string, bookId: string) => {
    try {
      const { error } = await supabase
        .from('book_list_items')
        .delete()
        .eq('list_id', listId)
        .eq('book_id', bookId);
      
      if (error) throw error;
      await fetchLists(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const reorderBooks = async (listId: string, items: { book_id: string; position: number }[]) => {
    try {
      for (const item of items) {
        await supabase
          .from('book_list_items')
          .update({ position: item.position })
          .eq('list_id', listId)
          .eq('book_id', item.book_id);
      }
      await fetchLists(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const duplicateList = async (listId: string) => {
    if (!userId) return null;
    
    try {
      // Get the original list
      const { data: originalList, error: listError } = await supabase
        .from('book_lists')
        .select('*')
        .eq('id', listId)
        .single();
      
      if (listError) throw listError;
      
      // Create new list with "(Copy)" suffix
      const { data: newList, error: createError } = await supabase
        .from('book_lists')
        .insert({
          user_id: userId,
          name: `${originalList.name} (Copy)`,
          description: originalList.description,
          is_public: originalList.is_public
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Get all books from the original list
      const { data: books, error: booksError } = await supabase
        .from('book_list_items')
        .select('book_id, position')
        .eq('list_id', listId)
        .order('position', { ascending: true });
      
      if (booksError) throw booksError;
      
      // Copy books to the new list
      if (books && books.length > 0) {
        const bookItems = books.map(book => ({
          list_id: newList.id,
          book_id: book.book_id,
          position: book.position
        }));
        
        const { error: insertError } = await supabase
          .from('book_list_items')
          .insert(bookItems);
        
        if (insertError) throw insertError;
      }
      
      await fetchLists(true);
      return newList;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  return {
    lists,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    createList,
    updateList,
    deleteList,
    addBookToList,
    removeBookFromList,
    reorderBooks,
    duplicateList,
    refetch: () => fetchLists(true)
  };
};
