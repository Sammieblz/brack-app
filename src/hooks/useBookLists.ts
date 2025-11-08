import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [error, setError] = useState<string | null>(null);

  const fetchLists = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('book_lists')
        .select(`
          *,
          book_list_items(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const listsWithCount = data?.map(list => ({
        ...list,
        book_count: list.book_list_items?.[0]?.count || 0
      })) || [];
      
      setLists(listsWithCount);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [userId]);

  const createList = async (name: string, description?: string) => {
    if (!userId) return null;
    
    try {
      const { data, error } = await supabase
        .from('book_lists')
        .insert({ user_id: userId, name, description })
        .select()
        .single();
      
      if (error) throw error;
      await fetchLists();
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
      await fetchLists();
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
      await fetchLists();
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
      await fetchLists();
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
      await fetchLists();
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
      await fetchLists();
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
      
      await fetchLists();
      return newList;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  return {
    lists,
    loading,
    error,
    createList,
    updateList,
    deleteList,
    addBookToList,
    removeBookFromList,
    reorderBooks,
    duplicateList,
    refetch: fetchLists
  };
};
