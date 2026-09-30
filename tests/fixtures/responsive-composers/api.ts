import type { Post, CreatePostRequest, PostMedia } from '../../../apps/client/src/services/api/social';
import type { BookClub, ClubsHomeResponse, CreateBookClubRequest } from '../../../apps/client/src/services/api/clubs';
import { post } from '../live-composers/api';
import { readAccount, request } from './state';
// Retain established shell/read boundaries. The target mutations below override
// the previous fixture's rejecting placeholders; no production API is imported.
export * from '../live-composers/api';
const stamp = '2026-09-30T12:00:00.000Z';
let sequence = 0;
const posts: Post[] = [post];
const clubs: BookClub[] = [{ id: 'club-fixture', name: 'The Chapter Circle', description: 'Thoughtful reading, shared slowly.',
  created_by: 'shell-reader', created_at: stamp, updated_at: stamp, is_private: false,
  genres: ['Fiction'], tags: ['Slow reading'], member_count: 2, discussion_count: 0, announcement_count: 0,
  user_role: 'member', join_status: 'member' }];
export async function getPostsFeed() {
  await request('posts-read', null);
  return { items: [...posts], has_more: false, caught_up: false, feed_mode: 'following' };
}
export async function getClubsHome(): Promise<ClubsHomeResponse> {
  await request('clubs-read', null);
  return { myClubs: [...clubs], suggested: [], nearby: [], popular: [], newest: [], invites: [], pendingRequests: [], searchResults: [],
    summary: { my_clubs: clubs.length, suggested: 0, nearby: 0, invites: 0, pending_requests: 0 } };
}
export async function createPost(payload: CreatePostRequest): Promise<Post> {
  const owner = readAccount();
  await request('post-create', payload);
  const saved: Post = { ...payload, id: `post-created-${++sequence}`, user_id: owner ?? 'departed-reader',
    created_at: stamp, updated_at: stamp, post_type: payload.post_type ?? 'text', visibility: payload.visibility ?? 'public',
    likes_count: 0, comments_count: 0, share_count: 0 };
  posts.unshift(saved);
  return saved;
}
export async function uploadPostMediaFiles(files: File[]): Promise<PostMedia[]> {
  await request('post-upload', files.map((file) => ({ name: file.name, type: file.type, size: file.size })));
  return files.map((file, position) => ({ storage_path: `fixture/post/${++sequence}-${file.name}`,
    media_type: file.type.startsWith('video/') ? 'video' : 'image', mime_type: file.type, size_bytes: file.size, position }));
}
export async function uploadClubImageFile(file: File, purpose: 'banner' | 'avatar'): Promise<string> {
  await request(purpose === 'banner' ? 'club-banner' : 'club-avatar', { name: file.name, type: file.type, size: file.size });
  return `fixture/club/${purpose}/${++sequence}-${file.name}`;
}
export async function createBookClub(payload: CreateBookClubRequest): Promise<BookClub> {
  const owner = readAccount();
  await request('club-create', payload);
  const saved: BookClub = { ...payload, id: `club-created-${++sequence}`, created_by: owner ?? 'departed-reader',
    created_at: stamp, updated_at: stamp, is_private: payload.is_private ?? false, genres: payload.genres ?? [], tags: payload.tags ?? [],
    member_count: 1, discussion_count: 0, announcement_count: 0, user_role: 'admin', join_status: 'member' };
  clubs.unshift(saved);
  return saved;
}
export const discoverReaders = async () => ({ suggestions: [], nearby: [], connections: [], friendsOfFriends: [], activeFriends: [], searchResults: [] });
