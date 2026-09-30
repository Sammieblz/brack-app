# Form field semantics

Implemented F03 behavior for the affected profile, club, review, post and journal forms. The [batch checkpoint](frontend-renewal/14-next-implementation-batch.md) owns delivery status and broader verification. This contract does not certify accessibility conformance or native assistive-technology behavior.

Coverage correction at `db076cf`: live CommentThread comment/reply and MessageThread main composer were missed; one repaired ReviewComments component has no verified production importer. [CR01/checkpoint21](frontend-renewal/21-live-composers.md) owns the corrective implementation and current verification. The wider [consumer matrix](frontend-renewal/coverage-review/02-correctness-consumers.md) and [coverage plan](frontend-renewal/20-coverage-reconciliation.md) remain open for their other findings.

## Native inputs

[Input](../apps/client/src/components/ui/input.tsx) forwards native attributes and its ref. It does **not** manufacture an `aria-label` from a placeholder or use a generic “Input field” label: those fallbacks overrode meaningful visible labels.

Use a visible `Label` with matching `htmlFor`/`id`, or an explicit purpose-specific `aria-label`/`aria-labelledby` when there is no visible label. Keep placeholders as examples or hints. Forward `FormControl` attributes unchanged so its description, validation message and invalid state reach the input. Existing helper text needs an ID referenced by `aria-describedby`. Give repeated component instances distinct field IDs.

## Rich-text boundary

[RichTextEditor](../apps/client/src/components/rich-text/RichTextEditor.tsx) exposes the actual contenteditable element as a multiline textbox. Naming, descriptions, `aria-invalid`, `aria-required` and disabled state belong to that element, not its wrapper.

- Supply `labelledBy`, standard `aria-labelledby`, or `aria-label`. `labelledBy` takes precedence when both label-reference props are present. A visible label's `htmlFor` alone does not name a contenteditable div.
- `id` targets the textbox; otherwise the component generates a unique ID. The character-count element has its own derived ID, appended to `aria-describedby` alongside caller-provided instructions/errors. The count is not a live region announcing every keystroke.
- The forwarded `RichTextEditorHandle` exposes `focus()`. Form controllers pass their field ref and `onBlur`; validation can therefore focus the real editor and track blur.
- Prop changes update the editor's attributes. Removing a naming prop clears its old attribute; resolved errors leave no stale message reference or invalid state.
- `disabled` changes TipTap editability and toolbar availability. Programmatic content synchronization and editability changes do not emit a user draft change. An HTML fieldset alone cannot disable contenteditable.

[RichTextToolbar](../apps/client/src/components/rich-text/RichTextToolbar.tsx) gives formatting buttons explicit names and `aria-pressed` for toggled formats. Undo/redo retain action semantics. Link URL has a persistent native label. Keep these semantics when changing the visual treatment.

## Consumer and error ownership

The six rich-text consumers currently follow this contract:

| Consumer | Name and feedback |
| --- | --- |
| [ReviewForm](../apps/client/src/components/social/ReviewForm.tsx) | `Review *`; form description, field validation and ref/blur reach the editor. Submit/service errors are separate from content validation. |
| [CreatePostDialog](../apps/client/src/components/social/CreatePostDialog.tsx) | `Content *`; required-field errors target missing title/content, selection errors target Book/Book Club, and media errors describe Add Media. Publishing failures describe the submit action. |
| [DiscussionThread](../apps/client/src/components/clubs/DiscussionThread.tsx) | `Reply`; rejected submission preserves the reply and exposes associated error text. |
| [BookClubDetail](../apps/client/src/screens/BookClubDetail.tsx), discussion/announcement composer | `Message`; visible label and submit error are associated with the editor. |
| [JournalEntryDialog](../apps/client/src/components/JournalEntryDialog.tsx) | `Content *`; field-specific errors follow the journal contract below. |
| [QuickJournalEntryDialog](../apps/client/src/components/QuickJournalEntryDialog.tsx) | `Note *`, `Quote *` or `Reflection *`; same journal error contract. |

Use `aria-invalid` for an actual field-validation failure. A network, upload or general save failure does not establish that the writing is invalid. Present persistent inline error text with `role="alert"` and reference it from the relevant field, control group or submit action; retain entered values for retry. Avoid moving focus for unrelated service failures.

Journal `errorField` distinguishes `content`, `pageReference`, `photo` and a general error (`null`). Content/page validation marks and focuses only that field. Upload feedback describes the Photo group. General save failure describes the save button. See [journal editing](ui-journal-editing.md).

Review rating uses a named native radio group with `1 star` through `5 stars`, checked state, keyboard operation and a visible focus treatment. The existing rating validation remains intact. Profile helper text, club privacy instructions, search fields and adjacent comment/chat composers also have explicit associations; a shared primitive must not invent their purpose.

## Post and club creation tasks (CR02)

Feed's CreatePostDialog and the CreateClubDialog instances in BookClubs/Readers now have one screen-owned task outside responsive header replacement. Their labels, values, files and focused input/editor belong to that task; the header owns only its current trigger. See [adaptive task ownership](ui-adaptive-overlays.md#post-and-club-creation-ownership-cr02) for dismissal, lifecycle and upload rules. [Checkpoint22](frontend-renewal/22-responsive-composers.md) owns verification status; these source contracts do not certify other form consumers.

- Post creation keeps `Title *` and the real `Content *` editor named, plus named type, visibility, book/club and genre controls. Pending publication disables native controls, Radix selects, Tiptap editing and its formatting toolbar. A fieldset alone is insufficient for contenteditable. Selected media, writing and choices survive upload or publish rejection; publishing errors describe Publish Post rather than marking otherwise valid text invalid.
- Club creation retains unique labels for name, description, genres, tags, city, country and member limit. `Private Club` has its existing explanatory description. File inputs are explicitly named `Banner image` and `Profile image`; selected filenames describe them, and their visible image-picker labels show keyboard focus. Pending creation disables editing and file changes. Inline creation/upload errors describe Create Club and preserve all draft values and selections for retry.
- Both tasks expose pending status text and preserve the same task when a pending dismissal is refused. Dirty confirmation names the draft at risk, focuses Keep editing, and requires explicit Discard draft to clear it. Selection-only and media-only drafts are protected too. Successful save closes immediately; downstream feed/list refresh failure cannot convert confirmed creation into a failed form submission.

These are network social tasks with temporary in-memory drafts and upload caches. Account/authentication changes and route removal invalidate them; CR02 does not add an offline queue, persistent route drafts, a universal navigation guard or backend idempotency. Native file pickers, hardware keyboards, VoiceOver/TalkBack and complete screen-family accessibility traversal remain separate evidence requirements.

## Verification and limits

### Live comments and chat (CR01)

- CommentThread's actual comment and recursive reply textareas use visible labels, unique IDs, persistent instructions and associated submission errors. Enter remains a newline; keyboard users activate the native Comment/Reply button. Direct and club chat retain Enter-to-send and Shift+Enter newline, excluding IME confirmation. A service rejection does not mark valid writing invalid or steal focus.
- A synchronous pending guard serializes each composer. Readers may continue typing; a successful response clears only the submitted text revision, including protection for text replaced with the same value. Chat attachment/reply changes are locked during submission. Errors preserve text, files and reply context for retry. Unchanged direct/club retries reuse the existing client message ID and completed upload results; this uses the existing API contract and does not create an offline queue.
- PostCard lazily mounts its comment thread and retains it on local collapse. Visited Feed/Profile Posts and club Chat panels retain their task owners while hidden; comment and club-message history subscriptions pause. Recursive reply collapse retains descendants and their drafts. Route/account/entity removal still ends in-memory comment/club tasks. CR02's separate section above covers post/club creation headers; Messages pane replacement remains CR05 work and other header utilities remain separately tracked.
- Direct-message text drafts are keyed by reader and conversation. Legacy conversation-only localStorage entries remain untouched but are not loaded: their owner cannot be established. This deliberately avoids showing another reader an unowned legacy draft. Attachments and retry state are in memory only.
- Media previews in direct and club chat have named headings/descriptions, reachable Close controls, failure feedback and explicit thumbnail focus return for Close/Escape/app Back. GIF errors stay in their open dialog, retain the result/retry target, and pending sends consume dismissal until an outcome arrives. Native hardware behavior still needs device evidence.

Exact current commands/results and the distinction between unit, real-consumer browser, visual and device evidence are recorded in [checkpoint21](frontend-renewal/21-live-composers.md). The F03 results below are historical; they are not new CR01 passes.

The focused command below passed **34 tests across five files** on 2026-09-27:

```sh
npm --workspace @brack/client run test -- src/components/rich-text/RichTextEditor.test.tsx src/components/FrontendFormAccessibility.test.tsx src/components/ui/input.test.tsx src/hooks/useJournalEditor.test.tsx src/components/ReaderSubmissionLoading.test.tsx
```

- [Input tests](../apps/client/src/components/ui/input.test.tsx): visible native/FormControl labels, explicit ARIA names, placeholder hints and validation references.
- [Rich-text tests](../apps/client/src/components/rich-text/RichTextEditor.test.tsx): textbox attributes, dynamic clearing, focus ref, unique count descriptions, disabled state without draft updates, toggle state and Link URL naming. Local jsdom geometry shims permit editor initialization; these tests do not measure layout.
- [Form tests](../apps/client/src/components/FrontendFormAccessibility.test.tsx): profile descriptions/save failure, club privacy/create failure and reusable comment failure/retry.
- [Journal hook tests](../apps/client/src/hooks/useJournalEditor.test.tsx): field error classification alongside save, attachment and draft lifecycle regressions.
- [Reader submission tests](../apps/client/src/components/ReaderSubmissionLoading.test.tsx): actual ReviewDetail and ClubChatThread composers retain drafts and associate rejected-submit feedback; existing loading guards remain covered.

The [frontend semantics browser suite](../tests/e2e/frontend-semantics.spec.ts) exercises the actual ReviewForm, radio selection, validation focus/error clearing, toolbar and link popover. The [journal browser fixture](../tests/fixtures/journal-save/README.md) protects the existing journal interactions after shared-editor changes. Consult the tracker for completed browser runs. Service boundaries are synthetic in these fixtures. VoiceOver, TalkBack, other real screen readers, native keyboards and full form-family device traversal remain unverified.
