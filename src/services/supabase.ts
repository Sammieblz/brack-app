import { supabase } from "@/integrations/supabase/client";
import type { User, Book, Goal, ReadingHabits, ReadingSession } from "@/types";

export class BookService {
  static async getUserBooks(userId: string): Promise<Book[]> {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async createBook(book: Omit<Book, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Book> {
    const { data, error } = await supabase
      .from('books')
      .insert(book)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateBook(id: string, updates: Partial<Book>): Promise<Book> {
    const { data, error } = await supabase
      .from('books')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteBook(id: string): Promise<void> {
    const { error } = await supabase
      .from('books')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getBookById(id: string): Promise<Book | null> {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }
}

export class GoalService {
  static async getUserGoal(userId: string): Promise<Goal | null> {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  static async createGoal(goal: Omit<Goal, 'id' | 'created_at'>): Promise<Goal> {
    const { data, error } = await supabase
      .from('goals')
      .insert(goal)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

export class ReadingHabitsService {
  static async getUserHabits(userId: string): Promise<ReadingHabits | null> {
    const { data, error } = await supabase
      .from('reading_habits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  static async createHabits(habits: Omit<ReadingHabits, 'id' | 'created_at'>): Promise<ReadingHabits> {
    const { data, error } = await supabase
      .from('reading_habits')
      .insert(habits)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

export class ReadingSessionService {
  static async createSession(session: Omit<ReadingSession, 'id' | 'created_at'>): Promise<ReadingSession> {
    const { data, error } = await supabase
      .from('reading_sessions')
      .insert(session)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getUserSessions(userId: string, bookId?: string): Promise<ReadingSession[]> {
    let query = supabase
      .from('reading_sessions')
      .select('*')
      .eq('user_id', userId);
    
    if (bookId) {
      query = query.eq('book_id', bookId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
}