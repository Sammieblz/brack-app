import { useEffect, useState } from "react";
import { useRetainedReaderResource } from "@/hooks/useRetainedReaderResource";
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
  const resource = useRetainedReaderResource(userId, fetchGoalsApi);
  const goals = resource.data ?? [];
  const activeGoals = goals.filter((goal) => goal.is_active);
  const fetchGoals = resource.refetch;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [userId, resource.refreshing]);

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
    loading: resource.loading,
    refreshing: resource.refreshing,
    hasLoaded: resource.data !== undefined,
    error: error || (resource.error ? "Reading goals could not be refreshed." : null),
    createGoal,
    updateGoal,
    deleteGoal,
    completeGoal,
    refetch: fetchGoals
  };
};
