# Conversation Summary Model

Source date: 2026-06-08
Scope: modern one-to-one messaging inbox summaries.

## Implemented Path

Primary migration: `supabase/migrations/20260506170000_modern_direct_messaging.sql`

Primary Edge Function: `conversations-home`

Frontend service: `fetchConversations` in `apps/client/src/services/api/messaging.ts`

## Response Shape

Each summary contains:
- conversation id
- participant ids
- created/updated timestamps
- other participant profile
- latest message preview
- unread count for the current user, based on `conversation_reads`
- per-user mute, pin, archive, and hidden inbox state
- blocked-pair disabled state

## Query Behavior

The Edge Function:
- Authenticates the caller from the Supabase JWT.
- Reads conversations where the user is either participant.
- Joins the other user's profile summary.
- Reads the latest non-deleted message and registered media count.
- Computes unread counts by comparing message timestamps to the caller's read cursor.
- Applies per-user settings, hiding conversations with `hidden_at`.
- Returns blocked conversations as disabled history rather than signing media or allowing sends.

This replaces both the old N+1 client query pattern and the intermediate `get_conversation_summaries` RPC as the app-facing inbox boundary.

## Index Support

Existing indexes:
- `idx_conversations_participant_one`
- `idx_conversations_participant_two`
- `idx_messages_conversation_created`
- `idx_messages_conversation_id`
- `idx_messages_sender_id`
- `idx_messages_conversation_active_created`
- `idx_conversation_reads_user`
- `idx_conversation_user_settings_user`

