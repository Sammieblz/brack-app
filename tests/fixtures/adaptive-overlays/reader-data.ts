/** Synthetic reader/data boundary; actual Goals forms and nested overlays render. */
export const useAuth = () => ({ user: { id: 'fixture-reader' }, loading: false });
const unexpectedWrite = async () => { throw new Error('This presentation fixture must not write goals'); };
export const useGoals = () => ({
  goals: [], activeGoals: [], loading: false, refreshing: false, hasLoaded: true, error: null,
  refetch: async () => undefined,
  createGoal: unexpectedWrite, deleteGoal: unexpectedWrite, completeGoal: unexpectedWrite,
});
