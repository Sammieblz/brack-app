# Club Roles and Permissions

Source date: 2026-06-07  
Scope: ticket 7.1, club role policy and RLS/frontend alignment.

## Role Model

| Role | Source | Meaning |
| --- | --- | --- |
| Owner | `book_clubs.created_by` | Structural owner of the club record. The creator is also inserted into `book_club_members` as `admin`. |
| Admin | `book_club_members.role = 'admin'` | Can manage club settings, delete club, manage members, and moderate discussions. |
| Moderator | `book_club_members.role = 'moderator'` | Can moderate discussions/replies, but cannot manage membership or club settings. |
| Member | `book_club_members.role = 'member'` | Can read private club content and create discussions/replies. |

Current DB role constraint allows `admin`, `moderator`, and `member`. Owner is represented by `book_clubs.created_by`, not the role column.

## Allowed Actions

| Action | Owner | Admin | Moderator | Member | Public/authenticated non-member |
| --- | --- | --- | --- | --- | --- |
| View public club | Yes | Yes | Yes | Yes | Yes |
| View private club | Yes | Yes | Yes | Yes | Limited preview only |
| Create club | Yes | N/A | N/A | N/A | Any authenticated user |
| Update club | Via admin membership | Yes | No | No | No |
| Delete club | Via admin membership | Yes | No | No | No |
| Join public club | N/A | N/A | N/A | Self | Self |
| Request private club access | N/A | N/A | N/A | N/A | Self |
| Review join request | Via admin membership | Yes | No | No | No |
| Invite member | Via admin membership | Yes | No | No | No |
| Add member | Via admin membership | Yes | No | No | No |
| Update member role | Via admin membership | Yes | No | No | No |
| Leave club | Yes, if policy allows self-delete | Yes | Yes | Yes | N/A |
| View discussions | Yes | Yes | Yes | Yes | No for private clubs |
| Create discussion/reply | Yes | Yes | Yes | Yes | No |
| Delete own discussion | Yes | Yes | Yes | Yes for own rows | No |
| Pin announcement/discussion | Via admin membership | Yes | No | No | No |
| Delete any discussion | Via admin membership | Yes | Yes | No | No |

## RLS Alignment

Current helpers:
- `is_club_member(club_id, user_id)`
- `is_club_admin(club_id, user_id)`
- `is_club_moderator_or_admin(club_id, user_id)`

Current behavior:
- Private club select checks creator, public club, or membership.
- Club update/delete checks admin helper.
- Member role changes check admin helper.
- Discussion insert checks membership and author.
- Discussion update/delete checks author or moderator/admin helper.
- Join requests and invites are requester/invitee plus admin visible.

Frontend alignment:
- `BookClubDetail` uses `club-detail` for role, private preview, admin queues, discussions, announcements, and members.
- `BookClubCard` uses `club.user_role`, `join_status`, `request_id`, and `invite_id` to choose CTA.
- Because creators are inserted as admin, owner actions align with frontend admin checks.

## Follow-Ups

- Decide whether owner should become an explicit `book_club_members.role = 'owner'`.
- If owner becomes explicit, update type unions, role badges, RLS helpers, and creator trigger together.
- Give `moderator` explicit discussion moderation powers only after product wants that distinction.

