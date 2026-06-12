# Conversation and Message Permissions Audit

Source date: 2026-06-08
Scope: one-to-one conversation membership, message media, reactions, read cursors, and blocking.

## Conversation Rules

| Operation | Current rule |
| --- | --- |
| Read conversation | User must be `participant_one_id` or `participant_two_id`. |
| Create conversation | `get-or-create-conversation` creates normalized pairs involving self and rejects blocked pairs. |
| Update conversation | No normal client update policy; `update_conversation_timestamp` updates `updated_at` after message insert. |
| Hide conversation | `update-conversation-settings` sets `hidden_at` for the current user only. Shared conversation deletion is not exposed. |

`getOrCreateConversation` checks both participant orderings and normalizes pair order before insert. The table has a unique pair constraint, but pair ordering remains an API responsibility.

## Message Rules

| Operation | Current rule |
| --- | --- |
| Read messages | User must be a participant in the parent conversation. |
| Read media | User must be a participant and the pair must not be blocked; reads use signed Storage URLs. |
| Send message | `send-message` requires sender to be a participant and rejects blocked pairs. |
| Mark read | `mark-conversation-read` updates only the caller's `conversation_reads` row. |
| React | `toggle-message-reaction` allows one fixed reaction per user per message. |
| Delete message | `delete-message` lets the sender soft-delete their own message. |

## Current Query Pattern

`fetchConversations` calls `conversations-home`, which:
1. Reads all conversations where current user is either participant.
2. Applies current user's conversation settings.
3. Fetches profile previews, latest message previews, and media counts.
4. Computes unread counts from `conversation_reads`.
5. Returns blocked conversations as disabled history.

This keeps the app-facing inbox shape server-owned and avoids direct table aggregation in the browser.

`fetchMessages` now calls `conversation-detail`, which returns the thread, reactions, other reader profile summary, settings, and signed media URLs when allowed.

## Unread Strategy

Current unread state:
- `conversation_reads(conversation_id, user_id, last_read_message_id, read_at)`.
- Unread count is computed per user by messages after the caller's read cursor.
- Legacy `messages.is_read` may still be updated for compatibility, but it is not the authoritative read model.

Rules:
- A message is unread for the recipient until the recipient opens the thread or marks it read.
- Sender's own messages should never count as unread for the sender.
- Group conversations are not modeled in this pass, but per-user cursors avoid the old boolean-read limitation.

## Enforcement Status

RLS and Edge code enforce participant-only message access. The current hardening baseline is:
- blocked pairs cannot start/send/react or receive signed media URLs;
- uploaded media is stored in private `message-media` owner-prefixed paths;
- inbox deletion is per-user hide/archive behavior;
- selected-thread realtime is scoped to one conversation instead of a broad inbox subscription.
