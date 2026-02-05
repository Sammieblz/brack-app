import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Goal {
  id: string;
  user_id: string;
  target_books: number | null;
  target_pages: number | null;
  target_minutes: number | null;
  start_date: string | null;
  end_date: string | null;
  reminder_time: string | null;
  created_at: string;
  is_completed: boolean;
  goal_type: 'books_count' | 'pages_count' | 'reading_time';
  period_type: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  is_active: boolean;
  completed_at: string | null;
  updated_at: string | null;
}

export const useGoals = (userId?: string) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setGoals(data as Goal[] || []);
      setActiveGoals((data as Goal[])?.filter(g => g.is_active) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [userId]);

  const createGoal = async (goal: Partial<Goal>) => {
    if (!userId) return null;
    
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({ user_id: userId, ...goal })
        .select()
        .single();
      
      if (error) throw error;
      await fetchGoals();
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<Goal>) => {
    try {
      const { error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', goalId);
      
      if (error) throw error;
      await fetchGoals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);
      
      if (error) throw error;
      await fetchGoals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const completeGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .update({ is_completed: true, completed_at: new Date().toISOString(), is_active: false })
        .eq('id', goalId);
      
      if (error) throw error;
      await fetchGoals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return {
    goals,
    activeGoals,
    loading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    completeGoal,
    refetch: fetchGoals
  };
};
