import type { Conversation, ConversationSettings, Message, MessageMedia, SendMessageRequest } from '../../../apps/client/src/services/api/messaging';
import { request } from './state';
export * from '../adaptive-shell/data';

const noop = () => undefined;
const resolved = async () => undefined;
const unsupported = async () => { throw new Error('Unexpected mutation outside the Messages layout fixture'); };
const stamp = '2026-09-30T12:00:00.000Z';
const reader = { id: 'reader-taylor', display_name: 'Taylor Lane', avatar_url: null };
const secondReader = { id: 'reader-jules', display_name: 'Jules Avery', avatar_url: null };
const current = { id: 'shell-reader', display_name: 'Alex Reader', avatar_url: null };
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const image: MessageMedia = { id: 'image-one', media_source: 'upload', media_type: 'image', signed_url: '/reading-media.svg', mime_type: 'image/png' };
let conversations: Conversation[] = [reader, secondReader].map((other_user, index) => ({
  id: index ? 'conversation-two' : 'conversation-one', participant_one_id: current.id, participant_two_id: other_user.id,
  created_at: stamp, updated_at: stamp, other_user, is_blocked: false, message_eligibility: 'eligible', unread_count: index ? 2 : 0,
  last_message: { id: index ? 'second-one' : 'direct-one', content: index ? 'A new book recommendation' : 'Have you reached the next chapter?', message_type: 'text', created_at: stamp, sender_id: other_user.id },
}));
let messages: Message[] = Array.from({ length: 22 }, (_, index) => ({
  id: `direct-${index}`, conversation_id: 'conversation-one', sender_id: index % 3 === 0 ? current.id : reader.id,
  content: `Reading note ${index + 1}: The details in this chapter reward a second look.`, message_type: 'text',
  created_at: new Date(Date.parse(stamp) + index * 8 * 60_000).toISOString(),
}));
messages.push({ id: 'direct-media', conversation_id: 'conversation-one', sender_id: reader.id,
  content: 'Have you reached the next chapter?', message_type: 'media', created_at: stamp, media: [image] });
let sequence = 0;
window.addEventListener('fixture:incoming-message', () => {
  messages = [...messages, { id: `incoming-${++sequence}`, conversation_id: 'conversation-one', sender_id: reader.id,
    content: `A fresh thought ${sequence}`, message_type: 'text', created_at: stamp }];
  window.dispatchEvent(new Event('fixture:messages-refresh'));
});

export async function fetchConversations() { await request('conversations-read', null); return [...conversations]; }
export async function fetchConversationDetail(id: string) {
  await request('thread-read', id);
  const conversation = conversations.find((entry) => entry.id === id);
  if (!conversation) throw new Error('Conversation unavailable');
  return { conversation, other_user: conversation.other_user, messages: messages.filter((entry) => entry.conversation_id === id),
    is_blocked: false, message_eligibility: 'eligible' };
}
export const getOrCreateConversation = async (readerId: string) => {
  await request('open-conversation', readerId);
  return 'conversation-one';
};
export const subscribeToConversationChanges = (callback: () => void) => {
  window.addEventListener('messages-changed', callback);
  return () => window.removeEventListener('messages-changed', callback);
};
export const subscribeToMessages = (_id: string, callback: () => void) => {
  window.addEventListener('fixture:messages-refresh', callback);
  return () => window.removeEventListener('fixture:messages-refresh', callback);
};
export async function markConversationRead(id: string, lastMessage?: string | null) {
  // History loading marks the last message independently of the explicit row action.
  if (lastMessage !== undefined) return;
  await request('mark-read', id);
  conversations = conversations.map((entry) => entry.id === id ? { ...entry, unread_count: 0 } : entry);
}
export async function deleteConversation(id: string) {
  await request('hide', id);
  conversations = conversations.filter((entry) => entry.id !== id);
}
export async function updateConversationSettings(id: string, settings: Partial<ConversationSettings>) {
  await request('mute', { id, settings });
  conversations = conversations.map((entry) => entry.id === id ? { ...entry, settings: { ...entry.settings, ...settings } as ConversationSettings } : entry);
}
export const subscribeToTypingIndicator = () => ({ cleanup: noop, setTyping: resolved });
export async function sendMessage(input: SendMessageRequest | string, content?: string) {
  const payload = typeof input === 'string' ? { conversation_id: input, content } : input;
  await request('direct-send', payload);
  const message: Message = { id: `direct-saved-${++sequence}`, conversation_id: payload.conversation_id, sender_id: current.id,
    content: payload.content ?? null, media: payload.media ?? [], message_type: payload.gif ? 'gif' : payload.media?.length ? 'media' : 'text',
    reply_to_message_id: payload.reply_to_message_id, created_at: stamp };
  messages = [...messages, message];
  return message;
}
export async function uploadMessageMediaFiles(files: File[]) {
  await request('direct-upload', files.map((file) => file.name));
  return files.map((file) => ({ ...image, signed_url: pixel, storage_path: file.name }));
}
export async function searchMessageGifs(query: string) {
  await request('gif', query);
  return { results: [{ id: 'gif-one', provider: 'tenor', provider_id: 'gif-one', title: 'Reading celebration', url: '/reading-media.svg', preview_url: '/reading-media.svg' }] };
}
export async function blockUser(id: string) {
  await request('block', id);
  conversations = conversations.map(entry => entry.other_user?.id === id ? { ...entry, is_blocked: true } : entry);
}
export const toggleMessageReaction = unsupported;
export async function deleteMessage(id: string) {
  await request('delete-message', id);
  messages = messages.map(entry => entry.id === id ? { ...entry, deleted_at: stamp, content: null, media: [] } : entry);
}
