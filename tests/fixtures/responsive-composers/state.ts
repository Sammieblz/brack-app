export type Operation = 'post-upload' | 'post-create' | 'club-banner' | 'club-avatar' | 'club-create' | 'posts-read' | 'clubs-read';
type Mode = 'resolve' | 'reject' | 'defer';
type Request = { operation: Operation; payload: unknown; accountId: string | null };
const modes = new Map<Operation, Mode>();
const calls: Request[] = [];
const pending: Array<{ operation: Operation; resolve: () => void; reject: (error: Error) => void }> = [];
let accountId: string | null = 'shell-reader';
let online = true;
const subscribers = new Set<() => void>();
export const subscribe = (callback: () => void) => { subscribers.add(callback); return () => { subscribers.delete(callback); }; };
export const readAccount = () => accountId;
export const readOnline = () => online;
const notify = () => subscribers.forEach((callback) => callback());

export async function request(operation: Operation, payload: unknown) {
  calls.push({ operation, payload: structuredClone(payload), accountId });
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
  setAccount: (id: string | null) => { accountId = id; notify(); },
  setOnline: (value: boolean) => { online = value; notify(); },
  snapshot: () => ({ accountId, online, calls: structuredClone(calls), pending: pending.map(({ operation }) => operation) }),
};
