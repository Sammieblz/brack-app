import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  completeGoal as completeGoalApi,
  createGoal as createGoalApi,
  deleteGoal as deleteGoalApi,
  fetchGoals as fetchGoalsApi,
  updateGoal as updateGoalApi,
  type Goal,
} from "@/services/api";
import { invalidateDashboardHomeQueries } from "@/lib/dashboardQueries";

export type { Goal } from "@/services/api";

export const useGoals = (userId?: string) => {
  const queryClient = useQueryClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const data = await fetchGoalsApi(userId);
      setGoals(data);
      setActiveGoals(data.filter(g => g.is_active));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  const createGoal = async (goal: Partial<Goal>) => {
    if (!userId) return null;
    
    try {
      const data = await createGoalApi(userId, goal);
      await fetchGoals();
      void invalidateDashboardHomeQueries(queryClient, userId);
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<Goal>) => {
    try {
      await updateGoalApi(goalId, updates);
      await fetchGoals();
      void invalidateDashboardHomeQueries(queryClient, userId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      await deleteGoalApi(goalId);
      await fetchGoals();
      void invalidateDashboardHomeQueries(queryClient, userId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const completeGoal = async (goalId: string) => {
    try {
      await completeGoalApi(goalId);
      await fetchGoals();
      void invalidateDashboardHomeQueries(queryClient, userId);
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
