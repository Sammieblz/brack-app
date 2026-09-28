# Form field semantics

Implemented F03 behavior for the affected profile, club, review, post and journal forms. The [batch checkpoint](frontend-renewal/14-next-implementation-batch.md) owns delivery status and broader verification. This contract does not certify accessibility conformance or native assistive-technology behavior.

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

## Verification and limits

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
