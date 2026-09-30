export type Operation = 'profile-read' | 'profile-save' | 'personal-save' | 'reading-read' | 'reading-save' |
  'avatar-pick' | 'avatar-upload' | 'avatar-save' | 'notification-read' | 'notification-save' |
  'privacy-read' | 'privacy-save' | 'import-parse' | 'import-preview' | 'import-commit' | 'export' |
  'password-save' | 'sign-out' | 'theme-save';
type Mode = 'resolve' | 'reject' | 'defer';
const modes = new Map<Operation, Mode>();
const calls: Array<{ operation: Operation; payload: unknown; accountId: string | null }> = [];
const pending: Array<{ operation: Operation; resolve: () => void; reject: (error: Error) => void }> = [];
let accountId: string | null = 'shell-reader';
let authLoading = false;
const subscribers = new Set<() => void>();
export const subscribe = (callback: () => void) => { subscribers.add(callback); return () => { subscribers.delete(callback); }; };
export const readAccount = () => accountId;
export const readAuthLoading = () => authLoading;
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
    const index = pending.findIndex((entry) => entry.operation === operation);
    if (index < 0) throw new Error(`No pending ${operation}`);
    const [entry] = pending.splice(index, 1);
    if (outcome === 'resolve') entry.resolve(); else entry.reject(new Error(`Fixture ${operation} failed`));
  },
  setAccount: (id: string | null) => { accountId = id; notify(); },
  setAuthLoading: (value: boolean) => { authLoading = value; notify(); },
  snapshot: () => ({ accountId, authLoading, calls: structuredClone(calls), pending: pending.map(({ operation }) => operation) }),
};
