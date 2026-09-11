# Conversation and Message Permissions Audit

Source date: 2026-09-11
Scope: one-to-one conversation membership, message media, reactions, read cursors, and blocking.

## Conversation Rules

| Operation | Current rule |
| --- | --- |
| Read conversation | User must be `participant_one_id` or `participant_two_id`. |
| Create conversation | Both readers must exist, neither profile may be private, neither reader may have blocked the other, and both readers must follow each other. The Edge Function, RLS policy, and table trigger enforce the same database predicate. |
| Update conversation | No normal client update policy; `update_conversation_timestamp` updates `updated_at` after message insert. |
| Hide conversation | `update-conversation-settings` sets `hidden_at` for the current user only. Shared conversation deletion is not exposed. |

`getOrCreateConversation` checks both participant orderings and normalizes pair order before insert. The table has a unique pair constraint, but pair ordering remains an API responsibility. The client does not fall back to direct conversation creation when the Edge Function rejects or fails.

## Message Rules

| Operation | Current rule |
| --- | --- |
| Read messages | User must be a participant in the parent conversation. |
| Read media | User must be a participant and the pair must not be blocked; reads use signed Storage URLs. |
| Send message | `send-message` requires sender to be a participant and requires current mutual-follow eligibility. RLS and a table trigger independently reject direct inserts, including service-role paths. |
| Mark read | `mark-conversation-read` updates only the caller's `conversation_reads` row. |
| React | `toggle-message-reaction` allows one fixed reaction per eligible user per message. Read-only history does not accept new reactions or replies. |
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

## Relationship Changes and Existing History

- Losing a mutual follow makes an existing direct conversation read-only; text and previously available media remain readable.
- A block keeps existing text history readable but withholds signed media URLs, matching the existing safety behavior.
- Switching either profile to `private`, blocking, following, or unfollowing changes the canonical eligibility predicate immediately.
- Relationship and profile-visibility triggers touch `conversations.eligibility_updated_at`. Existing conversation Realtime subscriptions then refetch the server-owned eligibility state on every active client without reordering the inbox.
- Account deletion cascades the user's conversations and messages through the existing foreign keys.
- Club chat is not part of this policy and continues to use club membership and moderation rules.

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

RLS, Edge code, and database triggers enforce participant-only message access. The current hardening baseline is:
- only mutual followers with non-private profiles can start/send/react;
- blocks override mutual-follow state and prevent start/send/react in both directions;
- advisory transaction locks serialize sends with follow, block, privacy, and account-deletion changes;
- uploaded media is stored in private `message-media` owner-prefixed paths;
- inbox deletion is per-user hide/archive behavior;
- selected-thread realtime is scoped to one conversation instead of a broad inbox subscription.
