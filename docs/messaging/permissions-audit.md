# Conversation and Message Permissions Audit

Source date: 2026-05-05  
Scope: ticket 7.2, conversation membership, message read/write permissions, and unread strategy.

## Conversation Rules

| Operation | Current rule |
| --- | --- |
| Read conversation | User must be `participant_one_id` or `participant_two_id`. |
| Create conversation | Authenticated user creates a pair involving self. |
| Update conversation | No normal client update policy; `update_conversation_timestamp` updates `updated_at` after message insert. |
| Delete conversation | Service exposes delete by id, but RLS must restrict to participants. |

`getOrCreateConversation` checks both participant orderings before insert. The table has a unique pair constraint, but pair ordering normalization should remain an API responsibility.

## Message Rules

| Operation | Current rule |
| --- | --- |
| Read messages | User must be a participant in the parent conversation. |
| Send message | Sender must be the authenticated user and a participant in the parent conversation. |
| Mark read | Participant can update messages in their conversation; service updates unread messages not sent by current user. |
| Delete message | No delete policy in the current matrix. |

## Current Query Pattern

`fetchConversations`:
1. Reads all conversations where current user is either participant.
2. For each conversation, fetches the other user's profile.
3. For each conversation, fetches latest message.
4. For each conversation, counts unread messages.

This was correct for small data, but it was an N+1 query pattern. It has been replaced by `get_conversation_summaries(p_user_id)`, documented in `docs/messaging/conversation-summary.md`.

`fetchMessages`:
1. Reads messages by `conversation_id`, ordered by `created_at`.
2. Marks unread messages as read for the current user.

## Unread Strategy

Current unread state:
- `messages.is_read` boolean.
- Unread count is computed per conversation by counting messages where `is_read = false` and sender is not the current user.

Rules:
- A message is unread for the recipient until the recipient opens the thread.
- Sender's own messages should never count as unread for the sender.
- Group conversations are not modeled; the boolean read flag works only for two-person conversations.

Future summary strategy:
- Add conversation summary fields or a separate summary view/table:
  - latest message id/content/sender/time
  - per-user unread count or last-read cursor
- Prefer `conversation_reads(conversation_id, user_id, last_read_message_id, read_at)` if group messaging is likely.
- For two-person only, a denormalized `unread_count_participant_one` and `unread_count_participant_two` can work but is less flexible.

## Enforcement Status

RLS and service code enforce participant-only message access. The remaining hardening item is performance/summary modeling, tracked by ticket 7.3.
