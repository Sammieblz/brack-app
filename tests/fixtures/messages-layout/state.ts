export type Operation = 'direct-send' | 'direct-upload' | 'gif' | 'conversations-read' | 'thread-read' | 'mark-read' | 'mute' | 'hide' | 'delete-message' | 'block' | 'open-conversation';
type Mode = 'resolve' | 'reject' | 'defer';
type Request = { operation: Operation; payload: unknown };
const modes = new Map<Operation, Mode>();
const params = new URLSearchParams(location.search);
if (params.has('initialReadFailure')) modes.set('conversations-read', 'reject');
if (params.get('entry') === 'reader') modes.set('open-conversation', 'defer');
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
  refresh: () => { window.dispatchEvent(new Event('messages-changed')); window.dispatchEvent(new Event('fixture:messages-refresh')); },
  incoming: () => { window.dispatchEvent(new Event('fixture:incoming-message')); },
};
