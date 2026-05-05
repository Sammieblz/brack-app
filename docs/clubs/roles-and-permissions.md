# Club Roles and Permissions

Source date: 2026-05-05  
Scope: ticket 7.1, club role policy and RLS/frontend alignment.

## Role Model

| Role | Source | Meaning |
| --- | --- | --- |
| Owner | `book_clubs.created_by` | Structural owner of the club record. The creator is also inserted into `book_club_members` as `admin`. |
| Admin | `book_club_members.role = 'admin'` | Can manage club settings, delete club, manage members, and moderate discussions. |
| Moderator | `book_club_members.role = 'moderator'` | Intended moderation role; current RLS does not grant special powers beyond member. |
| Member | `book_club_members.role = 'member'` | Can read private club content and create discussions/replies. |

Current DB role constraint allows `admin`, `moderator`, and `member`. Owner is represented by `book_clubs.created_by`, not the role column.

## Allowed Actions

| Action | Owner | Admin | Moderator | Member | Public/authenticated non-member |
| --- | --- | --- | --- | --- | --- |
| View public club | Yes | Yes | Yes | Yes | Yes |
| View private club | Yes | Yes | Yes | Yes | No |
| Create club | Yes | N/A | N/A | N/A | Any authenticated user |
| Update club | Via admin membership | Yes | No | No | No |
| Delete club | Via admin membership | Yes | No | No | No |
| Join public club | N/A | N/A | N/A | Self | Self |
| Add member | Via admin membership | Yes | No | No | No |
| Update member role | Via admin membership | Yes | No | No | No |
| Leave club | Yes, if policy allows self-delete | Yes | Yes | Yes | N/A |
| View discussions | Yes | Yes | Yes | Yes | No for private clubs |
| Create discussion/reply | Yes | Yes | Yes | Yes | No |
| Delete own discussion | Yes | Yes | Yes | Yes for own rows | No |
| Delete any discussion | Via admin membership | Yes | No | No | No |

## RLS Alignment

Current helpers:
- `is_club_member(club_id, user_id)`
- `is_club_admin(club_id, user_id)`

Current behavior:
- Private club select checks creator, public club, or membership.
- Club update/delete checks admin helper.
- Member role changes check admin helper.
- Discussion insert checks membership and author.
- Discussion delete checks author or admin helper.

Frontend alignment:
- `BookClubDetail` treats `userMember.role === 'admin'` as admin.
- `BookClubCard` treats `club.user_role === 'admin'` as admin.
- Because creators are inserted as admin, owner actions align with frontend admin checks.

## Follow-Ups

- Decide whether owner should become an explicit `book_club_members.role = 'owner'`.
- If owner becomes explicit, update type unions, role badges, RLS helpers, and creator trigger together.
- Give `moderator` explicit discussion moderation powers only after product wants that distinction.

