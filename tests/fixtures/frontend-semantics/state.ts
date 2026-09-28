import { QueryClient } from '@tanstack/react-query';
import type { GamificationNotification } from '../../../apps/client/src/services/api/userNotifications';

export const queryClient = new QueryClient({ defaultOptions: {
  queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false },
} });
const params = new URLSearchParams(window.location.search);
let readerId: string | null = params.has('anonymous') ? null : 'fixture-reader';
let headerVersion = 0;
let flags = { socialEnabled: params.get('social') !== 'off', gamificationEnabled: params.get('journey') !== 'off', leaderboardsEnabled: true, loaded: true };
const listeners = new Set<() => void>();
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getReaderId = () => readerId;
export const getHeaderVersion = () => headerVersion;
export const getFlags = () => flags;
const notify = () => listeners.forEach((listener) => listener());

export const seedNotifications: GamificationNotification[] = [{
  id: 'notification-one', notification_type: 'quest_completed', title: 'A reading milestone',
  body: 'Your reading quest is ready to review.', data: {}, read_at: null, created_at: '2026-09-27T12:00:00Z',
}, {
  id: 'notification-two', notification_type: 'badge_earned', title: 'A new reading badge',
  body: 'View the badge in your Reader Journey.', data: {}, read_at: null, created_at: '2026-09-27T11:00:00Z',
}];

type PendingFetch = { resolve: (rows: GamificationNotification[]) => void; reject: (error: Error) => void };
type PendingMark = { id: string | null; readerId: string | null; resolve: () => void; reject: (error: Error) => void };
const fetches: PendingFetch[] = [];
const marks: PendingMark[] = [];
let fetchCalls = 0;
const markCalls: Array<{ id: string | null; readerId: string | null }> = [];
export const fetchNotifications = (): Promise<GamificationNotification[]> => {
  fetchCalls += 1;
  return new Promise((resolve, reject) => fetches.push({ resolve, reject }));
};
export const markNotification = (id: string | null): Promise<void> => {
  const ownerId = readerId;
  markCalls.push({ id, readerId: ownerId });
  return new Promise((resolve, reject) => marks.push({ id, readerId: ownerId, resolve, reject }));
};
export const renewalFixture = {
  notificationRows: () => structuredClone(seedNotifications),
  remountHeader: () => { headerVersion += 1; notify(); },
  snapshot: () => ({ fetchCalls, pendingFetches: fetches.length, markCalls: [...markCalls], pendingMarks: marks.length, readerId }),
  resolveNotifications: (rows = seedNotifications) => {
    const next = fetches.shift(); if (!next) throw new Error('No pending notification fetch'); next.resolve(rows);
  },
  rejectNotifications: () => {
    const next = fetches.shift(); if (!next) throw new Error('No pending notification fetch'); next.reject(new Error('Fixture fetch failure'));
  },
  resolveMark: () => { const next = marks.shift(); if (!next) throw new Error('No pending read mutation'); next.resolve(); },
  rejectMark: () => { const next = marks.shift(); if (!next) throw new Error('No pending read mutation'); next.reject(new Error('Fixture read failure')); },
  refresh: () => { void queryClient.invalidateQueries({ queryKey: ['user-notifications', readerId] }); },
  setReader: (id: string | null) => { readerId = id; notify(); },
  setFeatures: (next: Partial<typeof flags>) => { flags = { ...flags, ...next }; notify(); },
};
declare global { interface Window { renewalFixture: typeof renewalFixture; } }
window.renewalFixture = renewalFixture;
