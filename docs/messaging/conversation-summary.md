# Conversation Summary Model

Source date: 2026-05-05  
Scope: ticket 7.3, efficient conversation list summaries.

## Implemented Path

Migration: `supabase/migrations/20260505095000_conversation_summary_rpc.sql`

RPC: `get_conversation_summaries(p_user_id uuid)`

Frontend service: `fetchConversations` in `src/services/api/messaging.ts`

## Response Shape

Each summary contains:
- conversation id
- participant ids
- created/updated timestamps
- other participant profile
- latest message preview
- unread count for the current user

## Query Behavior

The RPC:
- Verifies `auth.uid() = p_user_id`.
- Reads conversations where the user is either participant.
- Uses lateral joins for latest message and unread count.
- Joins the other user's profile.
- Returns one ordered JSON array.

This replaces the previous N+1 pattern where the app loaded conversations, then fetched profile/latest message/unread count per conversation.

## Index Support

Existing indexes:
- `idx_conversations_participant_one`
- `idx_conversations_participant_two`
- `idx_messages_conversation_created`
- `idx_messages_conversation_id`
- `idx_messages_sender_id`

Future optimization, if unread counts become hot:
- Add partial index on `messages(conversation_id, sender_id) WHERE is_read = false`.
- Consider `conversation_reads` if group conversations are added.

