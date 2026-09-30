export type Operation = 'catalog' | 'books' | 'book-membership' | 'list-membership' | 'list-books' |
  'list-create' | 'list-update' | 'list-delete' | 'list-duplicate' | 'membership-add' | 'membership-remove' | 'book-delete' | 'list-reorder';
export type Mode = 'resolve' | 'reject' | 'defer';
const modes = new Map<string, Mode>();
const calls: Array<{ operation: Operation; payload: unknown; accountId: string | null; key: string }> = [];
const pending: Array<{ operation: Operation; key: string; resolve: () => void; reject: (error: Error) => void }> = [];
let accountId: string | null = 'shell-reader';
const subscribers = new Set<() => void>();
export const subscribe = (callback: () => void) => { subscribers.add(callback); return () => { subscribers.delete(callback); }; };
export const readAccount = () => accountId;
export async function request(operation: Operation, payload: unknown, key = '') {
  calls.push({ operation, payload: structuredClone(payload), accountId, key });
  const mode = modes.get(`${operation}:${key}`) ?? modes.get(operation) ?? 'resolve';
  if (mode === 'reject') throw new Error(`Fixture ${operation} failed`);
  if (mode === 'defer') await new Promise<void>((resolve, reject) => pending.push({ operation, key, resolve, reject }));
}
export const controls = {
  configure: (operation: Operation, mode: Mode, key = '') => { modes.set(key ? `${operation}:${key}` : operation, mode); },
  settle: (operation: Operation, outcome: 'resolve' | 'reject', key?: string) => {
    const index = pending.findIndex(entry => entry.operation === operation && (key === undefined || entry.key === key));
    if (index < 0) throw new Error(`No pending ${operation}:${key ?? '*'}`);
    const [entry] = pending.splice(index, 1);
    if (outcome === 'resolve') entry.resolve(); else entry.reject(new Error(`Fixture ${operation} failed`));
  },
  setAccount: (id: string | null) => { accountId = id; subscribers.forEach(callback => callback()); },
  snapshot: () => ({ accountId, calls: structuredClone(calls), pending: pending.map(({ operation, key }) => ({ operation, key })) }),
};
