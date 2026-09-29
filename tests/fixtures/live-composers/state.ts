export type Operation = 'comment' | 'direct-send' | 'direct-upload' | 'club-send' | 'club-upload' | 'gif';
type Mode = 'resolve' | 'reject' | 'defer';
type Request = { operation: Operation; payload: unknown };
const modes = new Map<Operation, Mode>();
const calls: Request[] = [];
const pending: Array<{ operation: Operation; resolve: () => void; reject: (error: Error) => void }> = [];

export async function request(operation: Operation, payload: unknown) {
  // Capture the actual submission, not a reference a later retry can mutate.
  calls.push({ operation, payload: structuredClone(payload) });
  const mode = modes.get(operation) ?? 'resolve';
  if (mode === 'reject') throw new Error(`Fixture ${operation} failed`);
  if (mode === 'defer') await new Promise<void>((resolve, reject) => pending.push({ operation, resolve, reject }));
}

export const controls = {
  configure: (operation: Operation, mode: Mode) => { modes.set(operation, mode); },
  settle: (operation: Operation, outcome: 'resolve' | 'reject') => {
    const index = pending.findIndex((candidate) => candidate.operation === operation);
    if (index < 0) throw new Error(`No pending ${operation}`);
    const [entry] = pending.splice(index, 1);
    if (outcome === 'resolve') entry.resolve();
    else entry.reject(new Error(`Fixture ${operation} failed`));
  },
  snapshot: () => ({ calls: structuredClone(calls), pending: pending.map(({ operation }) => operation) }),
};
