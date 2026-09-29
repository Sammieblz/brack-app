import type { Post, PostComment } from '../../../apps/client/src/services/api/social';
import type { Conversation, Message, MessageMedia, SendMessageRequest } from '../../../apps/client/src/services/api/messaging';
import type { ClubChatMessage, ClubDetailResponse, SendClubChatMessageRequest } from '../../../apps/client/src/services/api/clubs';
import { request } from './state';
export * from '../adaptive-shell/data';

const noop = () => undefined;
const resolved = async () => undefined;
const unsupported = async () => { throw new Error('Unexpected mutation outside the live-composers fixture'); };
const stamp = '2026-09-28T12:00:00.000Z';
const reader = { id: 'reader-taylor', display_name: 'Taylor Lane', avatar_url: null };
const current = { id: 'shell-reader', display_name: 'Alex Reader', avatar_url: null };
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const mediaUrl = new URLSearchParams(location.search).has('brokenMedia') ? '/missing-media.png' : '/reading-media.svg';
const image: MessageMedia = { id: 'image-one', media_source: 'upload', media_type: 'image', signed_url: mediaUrl, mime_type: 'image/png' };
export const post: Post = { id: 'post-reading', user_id: reader.id, title: 'A passage to return to',
  content: 'I kept thinking about this chapter on my walk home. What makes a scene stay with you?',
  post_type: 'text', visibility: 'public', likes_count: 4, comments_count: 1, share_count: 0,
  created_at: stamp, updated_at: stamp, user: reader, media: [] };
let comments: PostComment[] = [{ id: 'comment-one', post_id: post.id, user_id: reader.id,
  parent_id: null, content: 'The quiet details stayed with me.', depth: 0, reply_count: 0,
  created_at: stamp, updated_at: stamp, user: reader }];
const conversation: Conversation = { id: 'conversation-one', participant_one_id: current.id, participant_two_id: reader.id,
  created_at: stamp, updated_at: stamp, other_user: reader, is_blocked: false, message_eligibility: 'eligible', unread_count: 0,
  last_message: { id: 'direct-one', content: 'Have you reached the next chapter?', message_type: 'text', created_at: stamp, sender_id: reader.id } };
let directMessages: Message[] = [{ id: 'direct-one', conversation_id: conversation.id, sender_id: reader.id,
  content: 'Have you reached the next chapter?', message_type: 'media', created_at: stamp, media: [image] }];
let clubMessages: ClubChatMessage[] = [{ id: 'club-message-one', club_id: 'club-one', user_id: reader.id,
  content: 'Bring a passage you enjoyed to our next meeting.', message_type: 'media', created_at: stamp, user: reader, media: [image] }];
let sequence = 0;

export const getPostsFeed = async () => ({ items: [post], has_more: false, caught_up: false, feed_mode: 'following' });
export const getSocialFeed = async () => ({ activities: [], has_more: false, caught_up: true });
export const getPostById = async () => post;
export const togglePostLike = unsupported;
export const fetchPostComments = async (_postId: string, parentId?: string | null) => ({
  comments: comments.filter((entry) => (entry.parent_id ?? null) === (parentId ?? null)), has_more: false,
});
export async function addPostComment(postId: string, content: string, parentId?: string) {
  await request('comment', { postId, content, parentId: parentId ?? null });
  const comment: PostComment = { id: `comment-saved-${++sequence}`, post_id: postId, user_id: current.id,
    parent_id: parentId ?? null, content, depth: parentId ? 1 : 0, reply_count: 0,
    created_at: stamp, updated_at: stamp, user: current };
  comments = [...comments.map((entry) => entry.id === parentId ? { ...entry, reply_count: entry.reply_count + 1 } : entry), comment];
  return comment;
}
export const subscribeToPostComments = () => noop;
export const deletePostComment = unsupported;
export const fetchUserProfileWithStats = async () => ({ profile: { ...reader, created_at: stamp,
  bio: 'Reading slowly, sharing the passages that stay.', profile_visibility: 'public', current_streak: 3 },
  stats: { totalBooks: 12, booksRead: 8, currentlyReading: 2, badges: 4 }, gamification: null });
export const fetchUserProfileTabData = async () => ({ books: [], posts: [post], clubs: [] });
export const fetchConversations = async () => [conversation];
export const fetchConversationDetail = async () => ({ conversation, other_user: reader,
  messages: directMessages, is_blocked: false, message_eligibility: 'eligible' });
export const getOrCreateConversation = async () => conversation.id;
export const subscribeToConversationChanges = () => noop;
export const subscribeToMessages = () => noop;
export const markConversationRead = resolved;
export const subscribeToTypingIndicator = () => ({ cleanup: noop, setTyping: resolved });
export const subscribeToClubChatTypingIndicator = () => ({ cleanup: noop, setTyping: resolved });
export async function sendMessage(input: SendMessageRequest | string, content?: string) {
  const payload = typeof input === 'string' ? { conversation_id: input, content } : input;
  await request('direct-send', payload);
  const message: Message = { id: `direct-saved-${++sequence}`, conversation_id: conversation.id, sender_id: current.id,
    content: payload.content ?? null, media: payload.media ?? [], message_type: payload.gif ? 'gif' : payload.media?.length ? 'media' : 'text',
    reply_to_message_id: payload.reply_to_message_id, created_at: stamp };
  directMessages = [...directMessages, message];
  return message;
}
export async function uploadMessageMediaFiles(files: File[]) {
  await request('direct-upload', files.map((file) => file.name));
  return files.map((file) => ({ ...image, signed_url: pixel, storage_path: file.name }));
}
export const getClubDetail = async (): Promise<ClubDetailResponse> => ({
  club: { id: 'club-one', name: 'The Chapter Circle', description: 'A small reading group for thoughtful conversations.',
    created_by: reader.id, created_at: stamp, updated_at: stamp, is_private: false,
    genres: ['Fiction'], tags: ['Slow reading'], member_count: 2, discussion_count: 0, announcement_count: 0,
    user_role: 'member', join_status: 'member' },
  user_role: 'member', members: [reader, current].map((user) => ({ id: `membership-${user.id}`, club_id: 'club-one', user_id: user.id,
    role: 'member', joined_at: stamp, user })), discussions: [], announcements: [],
});
export const getClubChatHistory = async () => ({ messages: clubMessages, has_more: false });
export const subscribeToClubChat = () => noop;
export const markClubChatRead = resolved;
export async function sendClubChatMessage(payload: SendClubChatMessageRequest) {
  await request('club-send', payload);
  const message: ClubChatMessage = { id: `club-saved-${++sequence}`, club_id: 'club-one', user_id: current.id, user: current,
    content: payload.content ?? null, media: payload.media ?? [], message_type: payload.gif ? 'gif' : payload.media?.length ? 'media' : 'text',
    reply_to_message_id: payload.reply_to_message_id, created_at: stamp };
  clubMessages = [...clubMessages, message];
  return message;
}
export async function uploadClubChatMediaFiles(files: File[]) {
  await request('club-upload', files.map((file) => file.name));
  return files.map((file) => ({ ...image, signed_url: pixel, storage_path: file.name }));
}
export async function searchMessageGifs(query: string) {
  await request('gif', query);
  return { results: [{ id: 'gif-one', provider: 'tenor', provider_id: 'gif-one', title: 'Reading celebration', url: '/reading-media.svg', preview_url: '/reading-media.svg' }] };
}
export const searchGifs = searchMessageGifs;
export const discoverReaders = async () => ({ readers: [] });
export const getClubsHome = async () => ({ myClubs: [], suggested: [], nearby: [], popular: [], newest: [], invites: [], pendingRequests: [], searchResults: [], summary: {} });
export const createPost = unsupported;
export const uploadPostMediaFiles = unsupported;
export const createBookClub = unsupported;
export const deleteBookClub = unsupported;
export const inviteClubMember = unsupported;
export const joinBookClub = unsupported;
export const leaveBookClub = unsupported;
export const requestJoinClub = unsupported;
export const respondClubInvite = unsupported;
export const reviewJoinRequest = unsupported;
export const updateBookClub = unsupported;
export const blockUser = unsupported;
export const deletePost = unsupported;
export const sharePost = unsupported;
export const deleteConversation = unsupported;
export const updateConversationSettings = unsupported;
export const toggleMessageReaction = unsupported;
export const deleteMessage = unsupported;
export const deleteClubChatMessage = unsupported;
export const toggleClubChatReaction = unsupported;
export const createClubDiscussion = unsupported;
export const manageClubMember = unsupported;
export const moderateClubDiscussion = unsupported;
export const updateClubMedia = unsupported;
export const uploadClubDiscussionMediaFiles = unsupported;
export const uploadClubImageFile = unsupported;
